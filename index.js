import JSONSchemaFaker from 'json-schema-faker'
import SwaggerParser from '@apidevtools/swagger-parser'

const defaultOptions = {
  generator: {
    pathParams: true,
    body: true,
    optionalParams: true,
    useExampleValues: true,
    useDefaultValues: true
  },
  check: {
    status: true,
    examples: true,
    schema: true
  },
  contentType: 'application/json'
}

JSONSchemaFaker.format('binary', () => 'file.txt')

export async function generateWorkflow (file, {options = defaultOptions}) {
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
      baseURL: swagger.servers ? swagger.servers[0].url : undefined
    },
    tests: {},
  }

  if (options.check.schema) {
    workflow.components = {
      schemas: swagger.components.schemas
    }
  }

  const taggedSchemas = []
  for (const schema in swagger.components.schemas) {
    taggedSchemas.push({ id: `#/components/schemas/${schema}`, ...swagger.components.schemas[schema]})
  }

  if (swagger.tags) {
    swagger.tags.forEach(tag => {
      workflow.tests[tag.name] = {
        name: tag.description,
        steps: []
      }
    })
  } else {
    workflow.tests = {
      default: {
        name: 'Default',
        steps: []
      }
    }
  }

  for (const path in swagger.paths) {
    for (const method in swagger.paths[path]) {
      const step = {
        id: swagger.paths[path][method].operationId,
        name: swagger.paths[path][method].summary,
        method: method.toUpperCase(),
        url: swagger.paths[path][method].servers ? swagger.paths[path][method].servers[0].url : path,
      }

      if (swagger.paths[path][method].parameters) {
        swagger.paths[path][method].parameters.filter(param => !options.generator.optionalParams ? param.required : true).forEach(param => {
          const value =
            param.schema.default
            || param.example
            || (param.examples ? Object.values(param.examples)[0].value : false)
            || JSONSchemaFaker.generate(param.schema, taggedSchemas)

          if (param.in === 'path' && options.generator.pathParams) {
            step.url = step.url.replace(`{${param.name}}`, value)
          }

          if (param.in === 'query') {
            if (!step.params) step.params = {}
            step.params[param.name] = value
          }

          if (param.in === 'header') {
            if (!step.headers) step.headers = {}
            step.headers[param.name] = value
          }

          if (param.in === 'cookie') {
            if (!step.cookies) step.cookies = {}
            step.cookies[param.name] = value
          }
        })
      }

      if (options.generator.body && swagger.paths[path][method].requestBody && (!options.generator.optionalParams ? swagger.paths[path][method].requestBody.required : true)) {
        const requestBody = swagger.paths[path][method].requestBody.content

        for (const contentType in requestBody) {
          const body =
            requestBody[contentType].example
            || (requestBody[contentType].examples ? Object.values(requestBody[contentType].examples)[0].value : false )
            || JSONSchemaFaker.generate(requestBody[contentType].schema, taggedSchemas)

          if (!step.headers) step.headers = {}
          const bodyExists = step.json || step.xml || step.body || step.form || step.formData

          switch (contentType) {
            case 'application/json':
              if (contentType == options.contentType) {
                step.headers['Content-Type'] = contentType
                step.headers['accept'] = contentType
                step.json = body
              }
              break
            case 'application/xml':
              if (contentType == options.contentType) {
                step.headers['Content-Type'] = contentType
                step.headers['accept'] = contentType
                step.xml = body
              }
              break
            case 'application/x-www-form-urlencoded':
              if (!bodyExists) {
                step.headers['Content-Type'] = contentType
                step.form = body
              }
              break
            case 'multipart/form-data':
              if (!bodyExists) {
                step.headers['Content-Type'] = contentType
                step.formData = body
              }
              break
            case 'text/plain':
              if (!bodyExists) {
                step.headers['Content-Type'] = contentType
                step.body = body
              }
              break
            default:
              step.headers['Content-Type'] = contentType
              step.body = {
                file: body
              }
          }
        }
      }

      if (swagger.paths[path][method].responses && swagger.paths[path][method].responses['200']) {
        const response = swagger.paths[path][method].responses['200'].content[options.contentType]
        if (response) {
          step.check = {}
          if (options.check.status) {
            step.check.status = 200
          }

          if (options.check.schema) {
            step.check.schema = response.schema
          }

          if (options.check.examples) {
            step.check.json = response.example || (response.examples ? Object.values(response.examples)[0].value : undefined)
          }
        }
      }

      if (swagger.tags) {
        swagger.paths[path][method].tags.forEach(tag => workflow.tests[tag].steps.push(step))
      } else {
        workflow.tests.default.steps.push(step)
      }
    }
  }

  return workflow
}
