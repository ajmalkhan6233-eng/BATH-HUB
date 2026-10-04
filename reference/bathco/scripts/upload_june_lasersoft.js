'use strict';
const fs   = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const BASE = 'http://localhost:3000';

const FILES = [
    ['2026-06-01', 'C:/Users/DELL/Desktop/1122/DAY SALE/01-06-2026.xlsx'],
    ['2026-06-02', 'C:/Users/DELL/Desktop/1122/DAY SALE/02-06-2026.xlsx'],
    ['2026-06-03', 'C:/Users/DELL/Desktop/1122/DAY SALE/03-06-2026.xlsx'],
    ['2026-06-04', 'C:/Users/DELL/Desktop/1122/DAY SALE/04-06-2026.xlsx'],
    ['2026-06-05', 'C:/Users/DELL/Desktop/1122/DAY SALE/05-06-2026.xlsx'],
    ['2026-06-06', 'C:/Users/DELL/Desktop/1122/DAY SALE/06-06-2026.xlsx'],
    ['2026-06-07', 'C:/Users/DELL/Desktop/1122/DAY SALE/07-06-2026.xlsx'],
    ['2026-06-08', 'C:/Users/DELL/Desktop/1122/DAY SALE/08-06-2026.xlsx'],
    ['2026-06-09', 'C:/Users/DELL/Desktop/1122/DAY SALE/09-06-2026.xlsx'],
    ['2026-06-10', 'C:/Users/DELL/Desktop/1122/DAY SALE/10-06-2026.xlsx'],
    ['2026-06-11', 'C:/Users/DELL/Desktop/1122/DAY SALE/11-06-2026.xlsx'],
    ['2026-06-12', 'C:/Users/DELL/Desktop/1122/DAY SALE/12-06-2026.xlsx'],
    ['2026-06-13', 'C:/Users/DELL/Desktop/1122/DAY SALE/13-06-2026.xlsx'],
    ['2026-06-14', 'C:/Users/DELL/Desktop/1122/DAY SALE/14-06-2026.xlsx'],
    ['2026-06-15', 'C:/Users/DELL/Desktop/1122/DAY SALE/15-06-2026.xlsx'],
];

async function uploadOne(date, filePath) {
    const form = new FormData();
    form.append('files', fs.createReadStream(filePath), path.basename(filePath));
    const resp = await fetch(`${BASE}/api/daily-summary/${date}/files`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
        timeout: 30000,
    });
    const json = await resp.json();
    return { status: resp.status, json };
}

async function main() {
    console.log('Uploading June 1–15 Lasersoft files to', BASE);
    console.log('='.repeat(70));
    let ok = 0, fail = 0;
    for (const [date, file] of FILES) {
        process.stdout.write(date + '  ... ');
        try {
            const { status, json } = await uploadOne(date, file);
            if (status === 200) {
                const gp  = json.gross_profit  != null ? Number(json.gross_profit).toLocaleString()  : '?';
                const np  = json.net_profit    != null ? Number(json.net_profit).toLocaleString()    : '?';
                const gps = json.gp_status || '?';
                console.log('OK  gp=' + gp + '  np=' + np + '  gp_status=' + gps);
                ok++;
            } else {
                console.log('FAIL status=' + status + '  ' + JSON.stringify(json).slice(0, 120));
                fail++;
            }
        } catch (e) {
            console.log('ERROR  ' + e.message.slice(0, 100));
            fail++;
        }
    }
    console.log('='.repeat(70));
    console.log('Done:  ' + ok + ' OK,  ' + fail + ' failed');
}

main();
