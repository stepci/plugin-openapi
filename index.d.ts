export declare type GenerateWorkflowOptions = {
  generator: {
    pathParams: boolean,
    requestBody: boolean,
    optionalParams: boolean,
    useExampleValues: boolean,
    useDefaultValues: boolean
  },
  check: {
    status: boolean,
    examples: boolean,
    schema: boolean
  },
  contentType: string
}

export declare function generateWorkflow(file: any, options: GenerateWorkflowOptions): Promise<object>
export declare function generateWorkflowFile(file: any, output: string, options: GenerateWorkflowOptions): Promise<any>
