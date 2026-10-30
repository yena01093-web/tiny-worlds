import {serveFile} from '../../_lib/common.js';
export async function onRequestGet(context){return serveFile(context,true)}
