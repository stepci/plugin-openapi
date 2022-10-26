const { generateWorkflow } = require('../index.js')
const yaml = require('yaml')
const fs = require('fs')

generateWorkflow('./examples/petstore.yaml', {}).then(workflow => {
  fs.writeFileSync('workflow.yml', yaml.stringify(workflow))
})
