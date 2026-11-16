/* Monetary ledger uses integer satang; only confirmed transfers reduce debt.
   Pending notices are not money and never change a person's balance. */
const cents = n => Math.round(Number(n || 0) * 100);
function netBalances(expenses, splits, payments, memberIds=[]) {
  const balance = Object.fromEntries(memberIds.map(id=>[String(id),0]));
  for(const e of expenses) {
    const payer=String(e.paid_by);
    balance[payer]=(balance[payer]||0)+cents(e.amount);
  }
  for(const s of splits) {
    const id=String(s.user_id);
    balance[id]=(balance[id]||0)-cents(s.share_amount);
  }
  for(const p of payments) {
    if(p.status!=='paid')continue;
    const from=String(p.payer_id),to=String(p.payee_id),value=cents(p.amount);
    balance[from]=(balance[from]||0)+value;
    balance[to]=(balance[to]||0)-value;
  }
  return balance;
}
function settlementsForBalances(source) {
  const creditors=Object.entries(source).filter(([,v])=>v>0).map(([id,remaining])=>({id,remaining})).sort((a,b)=>b.remaining-a.remaining||a.id.localeCompare(b.id));
  const debtors=Object.entries(source).filter(([,v])=>v<0).map(([id,value])=>({id,remaining:-value})).sort((a,b)=>b.remaining-a.remaining||a.id.localeCompare(b.id));
  const settlements=[];
  for(let i=0,j=0;i<debtors.length&&j<creditors.length;){
    const amount=Math.min(debtors[i].remaining,creditors[j].remaining);
    if(amount>0)settlements.push({from:debtors[i].id,to:creditors[j].id,amount:amount/100});
    debtors[i].remaining-=amount;creditors[j].remaining-=amount;
    if(!debtors[i].remaining)i++;
    if(!creditors[j].remaining)j++;
  }
  return settlements;
}
async function ledgerFor(conn,tripId) {
  const [[expenses],[splits],[payments],[members]] = await Promise.all([
    conn.execute('SELECT paid_by,amount FROM expenses WHERE trip_id=?',[tripId]),
    conn.execute('SELECT s.user_id,s.share_amount FROM expense_splits s JOIN expenses e ON e.id=s.expense_id WHERE e.trip_id=?',[tripId]),
    conn.execute("SELECT payer_id,payee_id,amount,status FROM payments WHERE trip_id=? AND status='paid'",[tripId]),
    conn.execute('SELECT user_id FROM trip_members WHERE trip_id=?',[tripId])
  ]);
  return settlementsForBalances(netBalances(expenses,splits,payments,members.map(m=>m.user_id)));
}
module.exports={cents,netBalances,settlementsForBalances,ledgerFor};
