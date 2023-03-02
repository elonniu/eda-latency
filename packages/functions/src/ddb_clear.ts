import {Table} from "sst/node/table";
import {clearDdb} from "../../lib/Helper";

export const handler = async (event, context) => {
    return await clearDdb(Table.ddb_latency.tableName);
    // return await clearDdb(Table.ddb.tableName) + await clearDdb(Table.ddb_latency.tableName);
};
