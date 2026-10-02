// utils/sessionCap.js: several devices can be logged in as the same user at once. At most MAX_SESSIONS_PER_USER stay active;
// when a new login would make it more, the OLDEST logins are quietly dropped. Logout and expiry are untouched.
const MAX_SESSIONS_PER_USER = 5;

// Save the session row now (so it exists in the store), then trim this user's older sessions.
// Never blocks a login: any problem here is swallowed.
async function registerLogin(req, pool, userId, max = MAX_SESSIONS_PER_USER) {
    try {
        req.session.loginAt = Date.now();
        await new Promise(resolve => req.session.save(() => resolve()));
        await capSessions(pool, userId, req.sessionID, max);
    } catch (e) { /* login must still succeed */ }
}

// Keeps the newest `max` sessions of this user (the one just created always counts as newest) and deletes the rest.
async function capSessions(pool, userId, currentSid, max = MAX_SESSIONS_PER_USER) {
    await pool.query(
        `DELETE FROM session WHERE sid IN (
            SELECT sid FROM session
             WHERE (sess::jsonb)->'user'->>'id' = $1 AND sid <> $2
             ORDER BY COALESCE(((sess::jsonb)->>'loginAt')::bigint, 0) DESC, expire DESC
             OFFSET $3)`,
        [String(userId), String(currentSid), Math.max(0, max - 1)]);
}

module.exports = { registerLogin, capSessions, MAX_SESSIONS_PER_USER };