let axios = require('axios');
let pg = require('pg');
let limit = 200;
require('dotenv').config();

// get all months in date range
function dateRange(startDate, endDate) {
    let start = startDate.split('-');
    let end = endDate.split('-');
    let startYear = parseInt(start[0]);
    let endYear = parseInt(end[0]);
    let dates = [];

    for (let i = startYear; i <= endYear; i++) {
        let endMonth = i !== endYear ? 11 : parseInt(end[1]) - 1;
        let startMon = i === startYear ? parseInt(start[1]) - 1 : 0;
        for (let j = startMon; j <= endMonth; j = j > 12 ? j % 12 || 11 : j + 1) {
            let month = j + 1;
            let displayMonth = month < 10 ? '0' + month : month;
            dates.push([i, displayMonth, '01'].join('-'));
        }
    }
    return dates;
}

let verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

// get from and to dates
let from = process.env.DATE_FROM;
let to = process.env.DATE_TO;
//let cur = new Date();
//cur.setMonth(cur.getMonth() + 1);
//let to = cur.toISOString().split('T')[0];
let dates = dateRange(from, to);
dates[0] = from;
if (dates[dates.length -1] != to || from == to)
    dates[dates.length] = to;
let promises = [];

function getWorklogs(i, offset, data = [])
{
    return axios.get(
        'https://api.tempo.io/core/3/worklogs?limit=' + limit + '&from=' + dates[i] + '&to=' + dates[i + 1] + (offset ? '&offset=' + offset : ''),
        {headers: {'Authorization': 'Bearer ' + process.env.BEARER_TOKEN}}
    ).then(response =>
    {
	if (response.data.metadata.offset && response.data.results.length < 1)
            return data;
        data.push(response);
        if (response.data.results.length < 1 || response.data.metadata.count < limit)
            return data;
        return getWorklogs(i, response.data.metadata.offset + limit, data);
    });
}

// create Tempo API requests promises
for (let i = 0; i < dates.length - 1; i++) {
    promises.push(getWorklogs(i));
}

// run all requests at once
Promise.all(promises).then(valuess => {
    let logs = [];
    for (let values of valuess) {
        for (let value of values) {
            let worklog = value.data.results;
            if (Array.isArray(worklog)) {
                logs = logs.concat(worklog);
            }
        }
    }

    // connect to DB
    // The default env:
    // PGHOST='localhost'
    // PGUSER=process.env.USER
    // PGDATABASE=process.env.USER
    // PGPASSWORD=null
    // PGPORT=5432
    let client = new pg.Client();
    let queries = [];
    client.connect(err =>
    {
        if (err)
            throw new Error(err);

        if (verbose)
            console.log("Connected!");

        let corruptedUsernamesCount = 0;
        let corruptedJiraIdsCount = 0;

        for (let log of logs) {
            // run SQL UPDATE for each worklog
            if (typeof log.author === 'undefined' || typeof log.author.accountId === 'undefined') {
                corruptedUsernamesCount++;
                continue;
            }
            let userId = log.author.accountId;
            let user = "(SELECT user_key FROM cwd_user cwu, app_user au WHERE cwu.lower_user_name = au.lower_user_name AND external_id = '" + userId + "')";
            if (typeof log.jiraWorklogId === 'undefined') {
                corruptedJiraIdsCount++;
                continue;
            }
            let jiraId = log.jiraWorklogId;
            let sql = 'UPDATE worklog SET author = ' + user + ', updateauthor = ' + user + ' WHERE ID = \'' + jiraId + '\'';
            queries.push(client.query(sql)
                .then(() => console.log(verbose ? "Query: " + sql + " Done!" : "."))
                .catch(e => console.log('Error while processiong this command: ' + sql + '\nThe error: ' + e.message))
                .then(() => {return Promise.resolve();})
            );
        }
        Promise.all(queries).then(() => client.end().then(() =>
           {
               console.log('------------------------------------');
               console.log('jira_worklog_id missing count: ' + corruptedJiraIdsCount);
               console.log('username missing count: ' + corruptedUsernamesCount);
               if (verbose)
                   console.log('Connection closed.');
           }
        ));
    });
    //await client.end().then(() => console.log('Connection closed.'))
});
