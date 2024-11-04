const fetch = require("node-fetch")
const FormData = require('form-data');
async function main(params) {

  const aemRequestOptions = {
    method: "GET",
    headers: {"Authorization": params.token}
    };
  const formJsonResponse = await fetch(params.endpoint+ params.formPath +".model.json", aemRequestOptions);
  const formModel = await formJsonResponse.json();
  var schemaRef = [];
  var fdmTree = {};
 
  if(formModel.properties) {
    const properties =formModel.properties;
    if(properties.schemaRef) {
      schemaRef =properties.schemaRef;
    }
  }
  
  
  const aemGetRequestOptions = {
    method: "GET",
    headers: {"Authorization": params.token, "X-Adobe-Accept-Unsupported-Api": 1, "x-gw-ims-org-id": params["x-gw-ims-org-id"]}
  };
  const postResponse = await fetch(params.endpoint+ "/adobe/forms/fm/v1/schema/fields?path=" + schemaRef , aemGetRequestOptions);
  fdmTree = await postResponse.json();
  
  return {
    status: 200,
    body: JSON.stringify(fdmTree)
  };
}

exports.main = main;
