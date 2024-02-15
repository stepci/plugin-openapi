const JSONSchemaFaker = require('json-schema-faker')
const SwaggerParser = require('@apidevtools/swagger-parser')
const { dump } = require('js-yaml')
const fs = require('fs')
const merge = require('deepmerge')

const defaultOptions = {
  generator: {
    pathParams: true,
    requestBody: true,
    optionalParams: true,
    useExampleValues: true,
    useDefaultValues: true,
    inlineSchema: true
  },
  check: {
    status: true,
    examples: true,
    schema: true
  },
  contentType: 'application/json'
}

JSONSchemaFaker.format('binary', () => 'file.txt')

async function generateWorkflow (file, options) {
  options = merge(defaultOptions, options)

  JSONSchemaFaker.option({
    alwaysFakeOptionals: options.optionalParams,
    useExamplesValue: options.useExampleValues,
    useDefaultValue: options.useDefaultValues
  })

  const swagger = await SwaggerParser.parse(file)
  const workflow = {
    version: "1.0",
    name: swagger.info.title,
    config: {
      http: {
        baseURL: swagger.servers ? swagger.servers[0].url : undefined
      }
    },
    tests: {},
  }

  const taggedSchemas = []
  if (swagger.components?.schemas) {
    if (options.generator.inlineSchema) {
      workflow.components = {
        schemas: swagger.components?.schemas
      }
    }

    for (const schema in swagger.components.schemas) {
      taggedSchemas.push({ id: `#/components/schemas/${schema}`, ...swagger.components.schemas[schema] })
    }
  }

  if (swagger.tags) {
    swagger.tags.forEach(tag => {
      workflow.tests[tag.name] = {
        name: tag.description,
        steps: []
      }
    })
  }

  for (const path in swagger.paths) {
    for (const method in swagger.paths[path]) {
      const step = {
        id: swagger.paths[path][method].operationId,
        name: swagger.paths[path][method].summary,
        http: {
          url: swagger.paths[path][method].servers ? swagger.paths[path][method].servers[0].url : path,
          method: method.toUpperCase()
        }
      }

      if (swagger.paths[path][method].parameters) {
        swagger.paths[path][method].parameters.filter(param => !options.generator.optionalParams ? param.required : true).forEach(param => {
          const value =
            param.schema.default
            || param.example
            || (param.examples ? Object.values(param.examples)[0].value : false)
            || JSONSchemaFaker.generate(param.schema, taggedSchemas)

          if (param.in === 'path' && options.generator.pathParams) {
            step.http.url = step.http.url.replace(`{${param.name}}`, value)
          }

          if (param.in === 'query') {
            if (!step.http.params) step.http.params = {}
            step.http.params[param.name] = value
          }

          if (param.in === 'header') {
            if (!step.http.headers) step.http.headers = {}
            step.http.headers[param.name] = value
          }

          if (param.in === 'cookie') {
            if (!step.http.cookies) step.http.cookies = {}
            step.http.cookies[param.name] = value
          }
        })
      }

      if (options.generator.requestBody && swagger.paths[path][method].requestBody && (!options.generator.optionalParams ? swagger.paths[path][method].requestBody.required : true)) {
        const requestBody = swagger.paths[path][method].requestBody.content

        for (const contentType in requestBody) {
          const body =
            requestBody[contentType].example
            || (requestBody[contentType].examples ? Object.values(requestBody[contentType].examples)[0].value : false )
            || JSONSchemaFaker.generate(requestBody[contentType].schema, taggedSchemas)

          if (!step.http.headers) step.http.headers = {}
          const bodyExists = step.http.json || step.http.xml || step.http.body || step.http.form || step.http.formData

          switch (contentType) {
            case 'application/json':
              if (contentType == options.contentType) {
                step.http.headers['Content-Type'] = contentType
                step.http.headers['accept'] = contentType
                step.http.json = body
              }
              break
            case 'application/xml':
              if (contentType == options.contentType) {
                step.http.headers['Content-Type'] = contentType
                step.http.headers['accept'] = contentType
                step.http.xml = body
              }
              break
            case 'application/x-www-form-urlencoded':
              if (!bodyExists) {
                step.http.headers['Content-Type'] = contentType
                step.http.form = body
              }
              break
            case 'multipart/form-data':
              if (!bodyExists) {
                step.http.headers['Content-Type'] = contentType
                step.http.formData = body
              }
              break
            case 'text/plain':
              if (!bodyExists) {
                step.http.headers['Content-Type'] = contentType
                step.http.body = body
              }
              break
            default:
              step.http.headers['Content-Type'] = contentType
              step.http.body = {
                file: body
              }
          }
        }
      }

      if (swagger.paths[path][method].responses) {
        const response = Object.values(swagger.paths[path][method].responses)[0]
        const responseContent =  response.content?.[options.contentType]

        if (response) {
          if (Object.keys(options.check).length !== 0) step.http.check = {}
          if (options.check.status) {
            step.http.check.status = Number(Object.keys(swagger.paths[path][method].responses)[0])
          }
        }

        if (responseContent) {
          if (options.check.schema) {
            step.http.check.schema = responseContent.schema
          }

          if (options.check.examples) {
            step.http.check.json = responseContent.example || (responseContent.examples ? Object.values(responseContent.examples)[0].value : undefined)
          }
        }
      }

      if (swagger.tags && swagger.paths[path][method].tags) {
        swagger.paths[path][method].tags.forEach(tag => workflow.tests[tag].steps.push(step))
      } else {
        if (!workflow.tests.default) {
          workflow.tests.default = {
            name: 'Default',
            steps: []
          }
        }

        workflow.tests.default.steps.push(step)
      }
    }
  }

  return workflow
}

async function generateWorkflowFile (file, output, options) {
  return fs.promises.writeFile(output, dump(await generateWorkflow(file, options), {
    quotingType: '"'
  }))
}

module.exports = {
  generateWorkflow,
  generateWorkflowFile
}
