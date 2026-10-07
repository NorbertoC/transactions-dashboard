import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ForecastDashboard from '../../ForecastDashboard';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { forecastMessages } from '../messages';
const stored = new Map<string,string>();
let root: Root, container: HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('localStorage',{getItem:(key:string)=>stored.get(key) ?? null,setItem:(key:string,value:string)=>stored.set(key,value),clear:()=>stored.clear()});vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);localStorage.clear();container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const render=(income:number|null,expense:number|null,accountScope="synthetic-account-A")=>act(()=>root.render(<LocaleProvider><ForecastDashboard key={accountScope} accountScope={accountScope} income={income} expense={expense} coverage={<p>Verified fixture coverage</p>} /></LocaleProvider>));
function change(input:HTMLInputElement,value:string){act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('preserves user income while late verified coverage fills untouched inputs',()=>{render(null,null);const inputs=()=>container.querySelectorAll<HTMLInputElement>('.sf-future-A input');expect(inputs()[0].value).toBe('');change(inputs()[0],'9000');render(5000,3000);expect(inputs()[0].value).toBe('9000');expect(inputs()[1].value).toBe('3000');expect(container.querySelector<HTMLInputElement>('.sf-future-B input')!.value).toBe('5000');});
it('does not invent income and retains editable fields on invalid allocations',()=>{render(null,3000);expect(container.querySelectorAll('[role=alert]')).toHaveLength(2);expect(container.querySelector<HTMLInputElement>('.sf-future-A input')!.value).toBe('');expect(container.querySelector<HTMLInputElement>('.sf-future-A input')!.disabled).toBe(false);});
it('rejects malformed local drafts without losing current values',()=>{render(8000,3000);localStorage.setItem('gastos.forecast.selected11.v1:synthetic-account-A',JSON.stringify({version:1,name:'Bad',state:{buckets:[]}}));const load=[...container.querySelectorAll('button')].find(button=>button.textContent==='Load last save')!;act(()=>load.click());expect(container.querySelector('[role=status]')!.textContent).toContain('Could not');expect(container.querySelector<HTMLInputElement>('.sf-future-A input')!.value).toBe('8000');});
it('keyboard tabs expose relationships and share one model',()=>{render(8000,3000);const tabs=container.querySelectorAll<HTMLButtonElement>('[role=tab]');act(()=>tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})));expect(tabs[2].getAttribute('aria-selected')).toBe('true');expect(container.querySelector('[role=tabpanel]')!.getAttribute('aria-labelledby')).toBe(tabs[2].id);expect(document.activeElement).toBe(tabs[2]);});
vi.mock('../forecast.css',()=>({}));
vi.mock('../../budget/budget.css',()=>({}));
vi.mock('next-auth/react',()=>({useSession:()=>({status:'authenticated',data:{user:{id:'synthetic-account-A',email:'synthetic@example.test',authorized:true}}})}));
vi.mock('@/components/AuthGuard',()=>({default:({children}:{children:React.ReactNode})=>children}));
vi.mock('@/components/Header',()=>({default:()=> <nav>Visible navigation</nav>}));
const resource=vi.hoisted(()=>({transactions:[],loading:true,updating:false,slow:false,error:null as string|null,incomeAvailable:false,refetch:vi.fn()}));
vi.mock('@/hooks/useTransactions',()=>({useTransactions:()=>resource}));
vi.mock('@/hooks/useIncomeSummary',()=>({useIncomeSummary:()=>({summaries:null,loading:false,error:null,retry:vi.fn()})}));
vi.mock('@/services/recurring',()=>({fetchRecurringRules:vi.fn().mockResolvedValue([]),fetchRecurringProjection:vi.fn().mockImplementation((start:string,end:string)=>Promise.resolve({start,end,income_total:0,expense_total:0,items:[]}))}));
import ForecastPage from '@/app/forecast/page';
it('Forecast keeps navigation and read-only income unknown while loading or failing without inventing budget totals',async()=>{resource.loading=true;resource.error=null;await act(async()=>root.render(<LocaleProvider><ForecastPage /></LocaleProvider>));expect(container.textContent).toContain('Visible navigation');expect(container.querySelector('[aria-busy=true]')).not.toBeNull();expect(container.querySelector<HTMLInputElement>('.fb-income-field input')!.value).toBe('—');expect(container.querySelector<HTMLInputElement>('.fb-income-field input')!.readOnly).toBe(true);expect(container.querySelector('.fb-travel-result strong')!.textContent).toContain('—');resource.loading=false;resource.error='Unavailable';await act(async()=>root.render(<LocaleProvider><ForecastPage /></LocaleProvider>));expect(container.textContent).toContain('Visible navigation');expect(container.querySelector('[aria-busy=true]')).toBeNull();expect(container.querySelector('.section-unavailable')).not.toBeNull();expect(container.querySelector('.fb-travel-result strong')!.textContent).toContain('—');});

it('saved financial assumptions stay isolated by account and shared legacy drafts are not loaded',()=>{
 render(8000,3000);const button=(label:string)=>[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label)!;
 act(()=>button(forecastMessages.en.save).click());expect(stored.has('gastos.forecast.selected11.v1:synthetic-account-A')).toBe(true);
 render(null,null,'synthetic-account-B');act(()=>button('Load last save').click());expect(container.querySelector<HTMLInputElement>('.sf-future-A input')!.value).toBe('');
 expect(container.querySelector('[role=status]')!.textContent).toBe(forecastMessages.en.none);
 localStorage.setItem('gastos.forecast.selected11.v1',stored.get('gastos.forecast.selected11.v1:synthetic-account-A')!);
 act(()=>button('Load last save').click());expect(container.querySelector<HTMLInputElement>('.sf-future-A input')!.value).toBe('');
 render(null,null,'synthetic-account-A');act(()=>button('Load last save').click());expect(container.querySelector<HTMLInputElement>('.sf-future-A input')!.value).toBe('8000');
});
