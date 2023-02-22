const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DDB_TABLE_NAME = "DrawbyNumeralNetworkConnector";

exports.handler = async function (event, context, callback) {
  const request = event.Records[0].cf.request;
  const resource = request.uri.match(/^\/api\.v1\/net\/(\d{1,4})$/);

  if (resource) {
    const addr = parseInt(resource[1], 10);

    // An address of 0 or greater than 1000 is a bad request
    if (addr == 0 || addr > 1000) {
      callback(null, {
        body: '',
        bodyEncoding: 'text',
        status: 400,
        statusDescription: 'Bad Request'
      });
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

        callback(null, {
          body: data.Item?.Value?.N || '0',
          bodyEncoding: 'text',
          status: '200',
          statusDescription: 'OK'
        });

        console.log({
          method: 'GET',
          path: request.uri,
          address: resource[1],
          value: data.Item?.Value?.N || '0'
        });
      } catch (err) {
        callback(null, {
          body: '',
          bodyEncoding: 'text',
          status: '500',
          statusDescription: 'Internal Server Error'
        });

        console.log({
          method: 'GET',
          path: request.uri,
          address: resource[1],
          error: err
        });
      }

    } else if (request.method === 'PUT') {
      if (request.body.encoding !== 'base64' || request.body.inputTruncated === true) {
        callback(null, {
          body: '',
          bodyEncoding: 'text',
          status: 400,
          statusDescription: 'Bad Request'
        });

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
        callback(null, {
          body: '',
          bodyEncoding: 'text',
          status: 400,
          statusDescription: 'Bad Request'
        });
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

        callback(null, {
          body: match[1],
          bodyEncoding: 'text',
          status: '200',
          statusDescription: 'OK'
        });

        console.log({
          method: 'PUT',
          path: request.uri,
          address: resource[1],
          value: match[1]
        });
      } catch (err) {
        callback(null, {
          body: '',
          bodyEncoding: 'text',
          status: '500',
          statusDescription: 'Internal Server Error'
        });

        console.log({
          method: 'PUT',
          path: request.uri,
          address: resource[1],
          error: err
        });
      }
    } else {

      // Only GET and PUT requests are allowed
      callback(null, {
        body: '',
        bodyEncoding: 'text',
        status: '405',
        statusDescription: 'Method Not Allowed'
      });
    }
  } else {

    // If execution got here, the client had no forking clue what they were doing
    const response = {
      body: '',
      bodyEncoding: 'text',
      status: '404',
      statusDescription: 'Not Found'
    };

    callback(null, response);
  }
}