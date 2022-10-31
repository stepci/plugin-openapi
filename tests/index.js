const { generateWorkflowFile } = require('../index.js')
generateWorkflowFile('./tests/petstore.yaml', 'workflow.yml', {
  generator: {
    pathParams: false
  }
})
