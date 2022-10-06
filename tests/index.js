import { generateWorkflow } from "../index.js"
import yaml from 'yaml'
import fs from 'fs'

generateWorkflow('./examples/petstore.yaml', {}).then(workflow => {
  fs.writeFileSync('workflow.yml', yaml.stringify(workflow))
})
