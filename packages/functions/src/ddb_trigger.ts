import {Table} from "sst/node/table";
import {ddbPut, ms, s} from "../../lib/Helper";

export async function handler(event: Object, context: Object, callback: CallableFunction) {

    console.log(JSON.stringify({
        records: event.Records.length,
        size: Buffer.byteLength(JSON.stringify(event), 'utf8')
    }, null, "  "));

    let lists = [];

    for (let i in event.Records) {
        const {dynamodb} = event.Records[i];
        const {NewImage} = dynamodb;

        if (!NewImage) {
            continue;
        }

        const put_at_s = NewImage.put_at_ms.N.slice(0, 10);

        lists.push({
            PutRequest: {
                Item: {
                    id: NewImage.id.S,
                    put_at_ms: Number(NewImage.put_at_ms.N),
                    client: NewImage.client.S,
                    request_at_ms: Number(NewImage.request_at_ms.N),
                    received_at_ms: ms(),
                    created_from_put_s: Number(dynamodb.ApproximateCreationDateTime) - Number(put_at_s),
                    from_put_ms: ms() - Number(NewImage.put_at_ms.N),
                    from_requested_ms: ms() - Number(NewImage.request_at_ms.N),
                    from_put_s: s() - Number(put_at_s),
                    from_created_s: s() - Number(dynamodb.ApproximateCreationDateTime),
                    awsRequestId: context.awsRequestId,
                }
            }
        });

    }

    await ddbPut(Table.ddb_latency.tableName, lists);

    return {}
}
