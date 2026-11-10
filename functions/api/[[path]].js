import { handleAccount } from '../../lib/cloud-account.js';
export const onRequest = context => handleAccount(context.request, context.env);
