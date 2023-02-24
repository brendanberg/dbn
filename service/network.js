const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DDB_TABLE_NAME = "DrawbyNumeralNetworkConnector";

const HttpStatus = {
  200: 'OK',
  400: 'Bad Request',
  404: 'Not Found',
  405: 'Method Not Allowed',
  500: 'Internal Server Error',
};

const prepareResponse = (status, body) => {
  return {
    body: body,
    bodyEncoding: 'text',
    headers: {
      'access-control-allow-origin': [{
        key: 'Access-Control-Allow-Origin',
        value: '*'
      }],
      'access-control-allow-methods': [{
        key: 'Access-Control-Allow-Methods',
        value: 'PUT, GET, OPTIONS'
      }],
    },
    status: status,
    statusDescription: HttpStatus[status],
  }
};

exports.handler = async function (event, context, callback) {
  const request = event.Records[0].cf.request;
  const resource = request.uri.match(/^\/api\.v1\/net\/(\d{1,4})$/);

  if (resource) {
    const addr = parseInt(resource[1], 10);

    // An address of 0 or greater than 1000 is a bad request
    if (addr == 0 || addr > 1000) {
      callback(null, prepareResponse(400, ''));
      return;
    }

    const ddb = new DynamoDB({ apiVersion: '2012-10-08' });

    const params = {
      TableName: DDB_TABLE_NAME,
      Key: {
        'Address': { N: resource[1] },
      }
    };

    if (request.method === 'GET') {
      // Call DynamoDB to read the item from the table
      try {
        const data = await ddb.getItem(params);

        callback(null, prepareResponse('200', data.Item?.Value?.N || '0'));

        console.log({
          method: 'GET',
          path: request.uri,
          address: resource[1],
          value: data.Item?.Value?.N || '0'
        });
      } catch (err) {
        callback(null, prepareResponse(500, ''));

        console.log({
          method: 'GET',
          path: request.uri,
          address: resource[1],
          error: err
        });
      }

    } else if (request.method === 'PUT') {
      if (request.body.encoding !== 'base64' || request.body.inputTruncated === true) {
        callback(null, prepareResponse(400, ''));

        console.log({
          method: 'PUT',
          path: request.uri,
          address: resource[1],
          error: 'unable to parse request body'
        })
      }

      const body = Buffer.from(request.body.data, 'base64').toString('ascii').trim();
      const match = body.match(/^(\d+)$/);

      // There was no parsable number in the request body
      if (!match) {
        callback(null, prepareResponse(400, ''));
        return;
      }

      //const value = parseInt(match[1], 10);

      Object.assign(params, {
        UpdateExpression: "set #V = :val",
        ExpressionAttributeNames: {
          "#V": "Value"
        },
        ExpressionAttributeValues: {
          ":val": { N: match[1] },
        }
      });

      try {
        const data = await ddb.updateItem(params);

        callback(null, prepareResponse(200, match[1]));

        console.log({
          method: 'PUT',
          path: request.uri,
          address: resource[1],
          value: match[1]
        });
      } catch (err) {
        callback(null, prepareResponse(500, ''));

        console.log({
          method: 'PUT',
          path: request.uri,
          address: resource[1],
          error: err
        });
      }
    } else if (request.method === 'OPTIONS') {
      // Handle preflight requests
      callback(null, prepareResponse(200, ''));
    } else {
      // Only GET, PUT, and OPTIONS requests are allowed
      callback(null, prepareResponse(405, ''));
    }
  } else {

    // If execution got here, the client had no forking clue what they were doing
    callback(null, prepareResponse(404, ''));
  }
}
