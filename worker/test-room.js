// Local Miniflare harness only. Never used as the deployed entry point.
import {EscapeRoom} from './index.js';
export class TestRoom extends EscapeRoom {
 async advance(){const s=this.read();s.deadline=Date.now()-1;this.write(s);await this.alarm();}
 async expire(){const s=this.read();s.escapeDeadline=Date.now()-1;this.write(s);await this.alarm();}
}
export default {async fetch(request,env){const {actor,data}=await request.json();const room=env.GAME.get(env.GAME.idFromName('test'));if(data.action==='test-advance')await room.advance();if(data.action==='test-expire')await room.expire();return Response.json(await room.dispatch(actor,data.action.startsWith('test-')?{action:'sync'}:data));}};
