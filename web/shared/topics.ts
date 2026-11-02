import {kinds,number,type Topic} from './model.js';
interface TopicRow {row:HTMLLIElement;label:HTMLElement;count:HTMLElement;kind:HTMLElement;icon:HTMLElement;bar:HTMLElement}
export class TopicList {
  private rows=new Map<string,TopicRow>();
  constructor(private element:HTMLElement,private rowHeight:number,private maximum=6){}
  render(topics:Topic[]){
    const selected=topics.slice(0,this.maximum),ids=new Set(selected.map(t=>t.id)),highest=Math.max(1,...selected.map(t=>t.count_estimate));
    for(const [id,view]of this.rows)if(!ids.has(id)){view.row.remove();this.rows.delete(id);}
    selected.forEach((topic,index)=>{
      let view=this.rows.get(topic.id);
      if(!view){
        const row=document.createElement('li'),icon=document.createElement('span'),body=document.createElement('div'),line=document.createElement('div'),label=document.createElement('span'),count=document.createElement('span'),kind=document.createElement('span'),track=document.createElement('div'),bar=document.createElement('i');
        row.className='topic-row';icon.className='topic-icon';body.className='topic-body';line.className='topic-line';label.className='topic-label';count.className='topic-count';kind.className='topic-kind';track.className='topic-track';bar.className='topic-fill';
        line.append(label,count);track.append(bar);body.append(line,kind,track);row.append(icon,body);this.element.append(row);
        view={row,label,count,kind,icon,bar};this.rows.set(topic.id,view);
      }
      const kind=kinds[topic.kind]??kinds.reaction;
      view.row.dataset.kind=topic.kind;view.row.style.transform=`translateY(${index*this.rowHeight}px)`;
      view.row.style.height=`${this.rowHeight}px`;view.row.setAttribute('aria-posinset',String(index+1));view.row.setAttribute('aria-setsize',String(selected.length));view.row.title=topic.examples.join('\n');
      view.icon.textContent=kind.icon;view.label.textContent=topic.label;view.count.textContent=`~${number.format(topic.count_estimate)}`;view.kind.textContent=kind.label;view.bar.style.width=`${Math.max(2,topic.count_estimate/highest*100)}%`;
      // Match DOM reading order to visual rank without recreating rows or losing animation.
      this.element.append(view.row);
    });
    this.element.style.height=`${selected.length*this.rowHeight}px`;
  }
}
