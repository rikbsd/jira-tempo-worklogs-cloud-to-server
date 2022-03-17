Migrating Tempo worklogs from JIRA cloud to JIRA server is not yet supported, but you can get all the worklog data from Tempo API and then import it to JIRA server by using this script.

### USAGE

1. copy and rename .env.example to .env
2. fill .env with needed data
    * PGHOST, PGUSER, PGDATABASE, PGPASSWORD an PGPORT are self explanatory
    * BEARER_TOKEN - see [here](https://support.tempo.io/hc/en-us/articles/115011300208-Managing-access-control-for-integrations)
    * DATE_FROM - from what date you want to migrate worklogs, in YYYY-MM-DD format
    * DATE_TO - the date to ...
3. run ```npm install```
4. run ```node migrate.js```, you can use ```--verbose``` or ```-v``` parameter to show all executed SQL commands
5. Env variables passed via command line take precedence, for example ```DATE_FROM=2022-02-09 DATE_TO=2022-02-10 node migrate.js```
