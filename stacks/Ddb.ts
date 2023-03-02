import {Api, Function, StackContext, Table, use} from "sst/constructs";
import {Alias, StartingPosition} from "aws-cdk-lib/aws-lambda";
import {ddbExploreUrl, lambdaUrl, stackUrl} from "../packages/lib/ResourceUrl";
import {Duration} from "aws-cdk-lib";

export function DdbApi({stack, app}: StackContext) {

    const esm = new Table(stack, "ddb", {
        fields: {
            id: "string",
            put_at_ms: "number",
            request_at_ms: "number",
        },
        primaryIndex: {partitionKey: "id"},
        stream: "new_image",
        // cdk: {
        //     table: {
        //         writeCapacity: 15000,
        //         readCapacity: 15000,
        //     }
        // }
    });

    const apiFunction = new Function(
        stack, 'DdbApiFunction',
        {
            bind: [esm],
            functionName: `${app.stage}-${app.name}-ddb-api`,
            runtime: 'nodejs18.x',
            handler: "packages/functions/src/ddb_api.handler",
            currentVersionOptions: {
                provisionedConcurrentExecutions: 30,
            },
        });

    const alias = app.stage === 'prod'
        ? new Alias(stack, "DdbApiFunctionAlias", {
            aliasName: "live",
            version: apiFunction.currentVersion
        })
        : apiFunction

    const api = new Api(stack, "ddb-api", {
        routes: {
            "GET /": {
                cdk: {
                    function: alias
                }
            }
        },
    });

    stack.addOutputs({
        ApiEndpoint: api.url,
        esm: ddbExploreUrl(esm, app)
    });

    return {esm};
}

export function DdbTrigger({app, stack}: StackContext) {

    const {esm} = use(DdbApi);

    const cost = new Table(stack, "ddb_latency", {
        fields: {
            id: "string",
            time: "number",
            put_at_ms: "number",
            request_at_ms: "number",
            cost_put: "number",
            created_from_put: "number",
            from_requested_ms: "number",
            from_created_s: "number",
            from_put: "number",
            from_put_ms: "number",
            received_at_ms: "number",
        },
        primaryIndex: {partitionKey: "id"},
    });

    const triggerFunction = new Function(
        stack, 'DdbTriggerFunction',
        {
            bind: [cost, esm],
            functionName: `${app.stage}-${app.name}-ddb-trigger`,
            runtime: 'nodejs18.x',
            handler: "packages/functions/src/ddb_trigger.handler",
            currentVersionOptions: {
                provisionedConcurrentExecutions: 60,
            },
        });

    const options = {
        eventSourceArn: esm.cdk.table.tableStreamArn,
        retryAttempts: 0,
        batchSize: 100,
        startingPosition: StartingPosition.LATEST,
        // onFailure: new SqsDlq(dlq.cdk.queue),
        bisectBatchOnError: false,
        reportBatchItemFailures: true,
        maxBatchingWindow: Duration.seconds(0),
        maxRecordAge: Duration.seconds(60),
        parallelizationFactor: 10, // Concurrent batches per shard
        // tumblingWindow: Duration.seconds(1),
    };

    app.stage === 'prod'
        ? triggerFunction.currentVersion.addEventSourceMapping(`DdbTriggerFunctionEventSourceMapping`, options)
        : triggerFunction.addEventSourceMapping(`DdbTriggerFunctionEventSourceMapping`, options);

    new Function(
        stack, 'DdbClearFunction',
        {
            bind: [esm, cost],
            functionName: `${app.stage}-${app.name}-ddb-clear`,
            runtime: 'nodejs18.x',
            handler: "packages/functions/src/ddb_clear.handler",
            timeout: 60 * 10,
        });

    stack.addOutputs({
        esm_update: ddbExploreUrl(cost, app),
        fun: lambdaUrl(triggerFunction, app),
        Stack: stackUrl(stack.stackId, app),
    });

    return {esm, cost};
}
