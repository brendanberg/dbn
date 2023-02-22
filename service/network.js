const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DDB_TABLE_NAME = "DrawbyNumeralNetworkConnector";

exports.handler = async function (event, context, callback) {
  console.log("EVENT: \n" + JSON.stringify(event, null, 2))
  // return context.logStreamName;
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
        'Addr': { N: resource[1] },
      }
    };

    if (request.method === 'GET') {
      // Call DynamoDB to read the item from the table
      ddb.getItem(params, function (err, data) {
        if (err) {
          console.log("Error", err);
          callback(null, {
            body: '',
            bodyEncoding: 'text',
            status: '500',
            statusDescription: 'Internal Server Error'
          });
        } else {
          console.log("Success", data.Item);
          callback(null, {
            body: data.Item,
            bodyEncoding: 'text',
            status: '200',
            statusDescription: 'OK'
          });
        }
      });
      //return;

    } else if (request.method === 'PUT') {
      const body = request.body.match(/^(\d+)$/);

      // There was no parsable number in the request body
      if (!body) {
        callback(null, {
          body: '',
          bodyEncoding: 'text',
          status: 400,
          statusDescription: 'Bad Request'
        });
        return;
      }

      const value = parseInt(body[1], 10);

      Object.assign(params, {
        UpdateExpression: "set Value = :val",
        ExpressionAttributeValues: {
            ":val": { N: body[1] },
        }
      });

      ddb.updateItem(params, function(err, data) {
        if (err) {
          console.log(err);
          callback(null, {
            body: '',
            bodyEncoding: 'text',
            status: '500',
            statusDescription: 'Internal Server Error'
          });
        } else {
          console.log(data);
          callback(null, {
            body: value.toString(),
            bodyEncoding: 'text',
            status: '200',
            statusDescription: 'OK'
          });    
        }
      });

      //return;
    } else {

      // Only GET and PUT requests are allowed
      callback(null, {
        body: '',
        bodyEncoding: 'text',
        status: '405',
        statusDescription: 'Method Not Allowed'
      });
      return;

    }
  } else {

    // If execution got here, the client had no forking clue what they were doing
    const response = {
      body: '',
      bodyEncoding: 'text',
      // headers: {
      //     'header name in lowercase': [{
      //         key: 'header name in standard case',
      //         value: 'header value'
      //      }],
      // },
      status: '404',
      statusDescription: 'Not Found'
    };

    callback(null, response);
  }
}