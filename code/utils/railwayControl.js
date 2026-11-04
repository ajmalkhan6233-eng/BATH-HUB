// Railway control-plane client — fleet Stop/Start/Restart/Deploy for clients
// that run as their own dedicated Railway project.
//
// HARD RULES (policy, do not weaken):
//   1. Talks ONLY to Railway's public GraphQL API (deployment power actions).
//      It never connects to a client's database or reads any business data.
//   2. Disabled unless RAILWAY_API_TOKEN is set in .env — on this laptop that
//      stays unset, so every action fails fast with a clear message and zero
//      network calls to Railway.
//   3. Project-id blocklist: the vendor's own parked apex-platform project is
//      blocked by default (plus anything in APEX_FLEET_BLOCKED_PROJECT_IDS).
//      The live shop project (alert-cooperation) must never be entered as a
//      fleet row in the first place; add its id to the blocklist at go-live.
//
// NOTE: written offline against Railway's public API schema (backboard
// GraphQL v2). Before first REAL use with a token, verify the three mutation
// names against https://docs.railway.com/reference/public-api — adjust here
// if Railway has renamed them. Until then nothing calls Railway at all.
const RAILWAY_GQL = 'https://backboard.railway.com/graphql/v2';

// apex-platform (vendor's own parked project) is blocked from fleet actions
// by default — deploying/starting it would create Railway cost.
const DEFAULT_BLOCKED = ['8f1fbc70-fc2a-4198-a6a2-47055eba309b'];

function blockedProjectIds() {
    const extra = (process.env.APEX_FLEET_BLOCKED_PROJECT_IDS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
    return new Set([...DEFAULT_BLOCKED, ...extra]);
}

function controlEnabled() { return !!process.env.RAILWAY_API_TOKEN; }

async function gql(query, variables) {
    if (!controlEnabled()) {
        const err = new Error('Railway control actions are disabled — RAILWAY_API_TOKEN is not set in .env');
        err.status = 501;
        throw err;
    }
    const res = await fetch(RAILWAY_GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}` },
        body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Railway API HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
    if (body.errors?.length) throw new Error('Railway API: ' + body.errors[0].message);
    return body.data;
}

function assertActionable(client) {
    if (!client.railway_project_id || !client.railway_environment_id || !client.railway_service_id) {
        const err = new Error('Client row is missing railway_project_id / railway_environment_id / railway_service_id — fill them in before using control actions');
        err.status = 400;
        throw err;
    }
    if (blockedProjectIds().has(client.railway_project_id)) {
        const err = new Error(`Project ${client.railway_project_id} is on the fleet blocklist (vendor/live project) — refusing`);
        err.status = 403;
        throw err;
    }
}

async function latestDeployment(client) {
    const d = await gql(
        `query($input: DeploymentListInput!) {
           deployments(first: 1, input: $input) { edges { node { id status } } }
         }`,
        { input: { projectId: client.railway_project_id, environmentId: client.railway_environment_id, serviceId: client.railway_service_id } }
    );
    return d.deployments.edges[0]?.node || null;
}

// action ∈ stop | start | restart | deploy
//   stop    → remove the latest deployment (same effect as `railway down`)
//   restart → restart the latest deployment in place
//   start / deploy → redeploy the service's latest build in the environment
async function performAction(client, action) {
    assertActionable(client);
    if (action === 'restart' || action === 'stop') {
        const dep = await latestDeployment(client);
        if (!dep) {
            const err = new Error('No deployment found for this service — nothing to ' + action);
            err.status = 404;
            throw err;
        }
        if (action === 'restart') {
            await gql(`mutation($id: String!) { deploymentRestart(id: $id) }`, { id: dep.id });
            return { action, deploymentId: dep.id, previousStatus: dep.status };
        }
        await gql(`mutation($id: String!) { deploymentRemove(id: $id) }`, { id: dep.id });
        return { action, deploymentId: dep.id, previousStatus: dep.status };
    }
    if (action === 'start' || action === 'deploy') {
        await gql(
            `mutation($environmentId: String!, $serviceId: String!) { serviceInstanceDeploy(environmentId: $environmentId, serviceId: $serviceId) }`,
            { environmentId: client.railway_environment_id, serviceId: client.railway_service_id }
        );
        return { action };
    }
    const err = new Error('Unknown action — use stop, start, restart or deploy');
    err.status = 400;
    throw err;
}

// Health ping — plain HTTP GET to the client's public /health URL. Reads the
// STATUS CODE only; the response body is never stored or returned (control-
// plane status, no client data). 5s timeout.
async function pingHealth(healthUrl) {
    if (!healthUrl) return { state: 'UNKNOWN', note: 'no health_url configured' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
        const res = await fetch(healthUrl, { signal: ctrl.signal, redirect: 'follow' });
        return { state: res.ok ? 'ONLINE' : 'OFFLINE', httpStatus: res.status };
    } catch (e) {
        return { state: 'OFFLINE', note: e.name === 'AbortError' ? 'timeout (5s)' : e.message };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { performAction, pingHealth, controlEnabled, blockedProjectIds };
