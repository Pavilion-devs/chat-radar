import { LLMRequestError, retryDelay } from './errors.js';
import { parseOutput, usageLogger, type StructuredLLMClient, type StructuredRequest, type UsageLogger } from './types.js';
interface ResponseBody {
  status?:string;output?:{type:string;content?:{type:string;text?:string}[]}[];
  usage?:{input_tokens:number;output_tokens:number;total_tokens:number};
}
export class OpenAIClient implements StructuredLLMClient {
  constructor(private apiKey:string,private model:string,private request:typeof fetch=fetch,
    private usage:UsageLogger=usageLogger('openai')) {}
  async generate(input:StructuredRequest,signal:AbortSignal):Promise<unknown> {
    const response=await this.request('https://api.openai.com/v1/responses',{
      method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},signal,
      body:JSON.stringify({model:this.model,store:false,max_output_tokens:input.maxOutputTokens,
        instructions:input.instructions,input:[{role:'user',content:JSON.stringify(input.input)}],
        text:{format:{type:'json_schema',name:input.name,strict:true,schema:input.schema}}})
    });
    if (!response.ok) {
      if (response.status===429) {
        // Classify only known codes/types; never surface or log the error body.
        const body=await response.json().catch(()=>null) as {error?:{code?:string;type?:string}}|null;
        const quotaCodes=new Set(['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded','billing_hard_limit_reached']);
        if (quotaCodes.has(body?.error?.code || '') || body?.error?.type==='insufficient_quota') throw new LLMRequestError('openai',429,'quota');
        throw new LLMRequestError('openai',429,'rate_limit',retryDelay(response));
      }
      throw new LLMRequestError('openai',response.status,response.status===401?'authentication':[400,403,404].includes(response.status)?'configuration':'upstream');
    }
    const body=await response.json() as ResponseBody;
    const u=body.usage;
    if (u && [u.input_tokens,u.output_tokens,u.total_tokens].every(n=>Number.isSafeInteger(n) && n>=0)) this.usage({input_tokens:u.input_tokens,output_tokens:u.output_tokens,total_tokens:u.total_tokens});
    if (body.status!=='completed') throw new Error('OpenAI output incomplete');
    const content=(body.output || []).filter(item=>item.type==='message').flatMap(item=>item.content || []);
    if (content.some(item=>item.type==='refusal')) throw new Error('OpenAI request refused');
    const output=content.filter(item=>item.type==='output_text').map(item=>item.text || '').join('');
    return parseOutput(output);
  }
}
