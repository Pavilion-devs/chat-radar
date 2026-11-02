import { anthropicSchema } from './anthropic-schema.js';
import { LLMRequestError, retryDelay } from './errors.js';
import { parseOutput, validTokens, usageLogger, type StructuredLLMClient, type StructuredRequest, type UsageLogger } from './types.js';
interface Message {
  stop_reason?:string;stop_details?:{type?:string};content?:{type:string;text?:string}[];
  usage?:{input_tokens:number;output_tokens:number;cache_creation_input_tokens?:number;cache_read_input_tokens?:number};
}
export class AnthropicClient implements StructuredLLMClient {
  constructor(private apiKey:string,private model:string,private request:typeof fetch=fetch,private usage:UsageLogger=usageLogger('anthropic')) {}
  async generate(input:StructuredRequest,signal:AbortSignal):Promise<unknown> {
    // Apply the optional latency hint only to documented effort-capable families.
    // Legacy/unknown model IDs retain their native defaults rather than receiving an unsupported field.
    const supportsEffort=/^claude-(?:sonnet-(?:5|4-6)|haiku-5|opus-(?:5|4-[5-9])|fable-|mythos-)/.test(this.model);
    const effort=supportsEffort ? input.effort:undefined;
    const response=await this.request('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'x-api-key':this.apiKey,'anthropic-version':'2026-10-21','Content-Type':'application/json'},signal,
      body:JSON.stringify({model:this.model,max_tokens:input.maxOutputTokens,system:input.instructions,
        messages:[{role:'user',content:JSON.stringify(input.input)}],
        output_config:{...(effort?{effort}:{}),format:{type:'json_schema',schema:anthropicSchema(input.schema)}}})
    });
    if (!response.ok) {
      const body=await response.json().catch(()=>null) as {error?:{type?:string;message?:string}}|null;
      const type=body?.error?.type;
      // Match only fixed billing phrases internally. Never expose the response body.
      const billing=typeof body?.error?.message==='string' && /credit balance|spend limit|monthly spend|billing/i.test(body.error.message.slice(0,1000));
      if (response.status===402 || type==='billing_error' || billing) throw new LLMRequestError('anthropic',response.status,'quota');
      if (response.status===429) throw new LLMRequestError('anthropic',429,'rate_limit',retryDelay(response));
      const kind=response.status===401?'authentication':[400,403,404].includes(response.status)?'configuration':'upstream';
      throw new LLMRequestError('anthropic',response.status,kind);
    }
    const body=await response.json() as Message;const u=body.usage;
    if (u && validTokens(u.input_tokens) && validTokens(u.output_tokens)) {
      const created=u.cache_creation_input_tokens ?? 0,read=u.cache_read_input_tokens ?? 0;
      if (validTokens(created) && validTokens(read)) this.usage({input_tokens:u.input_tokens+created+read,output_tokens:u.output_tokens,total_tokens:u.input_tokens+created+read+u.output_tokens,cache_creation_input_tokens:created,cache_read_input_tokens:read});
    }
    if (body.stop_reason==='refusal' || body.stop_details?.type==='refusal') throw new Error('Anthropic request refused');
    if (body.stop_reason!=='end_turn') throw new Error('Anthropic output incomplete');
    return parseOutput((body.content || []).filter(block=>block.type==='text').map(block=>block.text || '').join(''));
  }
}
