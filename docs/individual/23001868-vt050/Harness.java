package com.ticketing.checkin.application.service;
import com.ticketing.checkin.application.port.*;
import com.ticketing.checkin.domain.model.*;
import com.ticketing.checkin.infrastructure.security.*;
import org.springframework.dao.DataIntegrityViolationException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Harness {
 static final UUID T=new UUID(0,1), E=new UUID(0,2), D=new UUID(0,3), K=new UUID(0,4);
 static final Instant NOW=VTClock.now();
 static int passed=0;
 static void check(boolean b,String msg){if(!b)throw new AssertionError(msg);}
 interface Task {void run() throws Exception;}
 static void test(String name,Task task)throws Exception {task.run();passed++;System.out.println("PASS "+name);}
 static class Repo implements CheckinRecordRepositoryPort {
  final Map<UUID,CheckinRecord> rows=new HashMap<>();
  int accepted=0, reads=0, writes=0; boolean fail=false;
  CyclicBarrier initialReads; AtomicInteger calls=new AtomicInteger(); int parties;
  public Optional<CheckinRecord> findByIdempotencyKey(UUID k){
   if(initialReads!=null && calls.incrementAndGet()<=parties){
    try {initialReads.await(10,TimeUnit.SECONDS);}catch(Exception ex){throw new RuntimeException(ex);}
    return Optional.empty(); // every concurrent caller observed the pre-commit state
   }
   synchronized(this){reads++;return Optional.ofNullable(rows.get(k));}
  }
  public synchronized CheckinRecord save(CheckinRecord r){
   if(fail)throw new DataIntegrityViolationException("unrelated constraint");
   if(rows.containsKey(r.getIdempotencyKey()))throw new DataIntegrityViolationException("unique idempotency_key");
   r.setId((long)rows.size()+1);rows.put(r.getIdempotencyKey(),r);writes++;return r;
  }
  public synchronized AcceptResult tryAccept(CheckinRecord r,int max){
   if(accepted>=max)return AcceptResult.ALL_ENTRIES_USED;
   // PostgreSQL unique violation rolls this transaction back; no accepted count increment.
   save(r);r.setEntryNo(++accepted);return AcceptResult.ACCEPTED;
  }
  public synchronized long countByEventIdAndOutcome(UUID e,CheckinOutcome o){return rows.values().stream().filter(x->x.getOutcome()==o).count();}
 }
 static class Devices implements DeviceRepositoryPort {
  DeviceStatus status=DeviceStatus.ACTIVE; boolean absent=false;
  public Optional<CheckinDevice> findByApiKeyHash(String hash){return absent?Optional.empty():Optional.of(CheckinDevice.builder().deviceId(D).status(status).build());}
  public CheckinDevice save(CheckinDevice d){return d;}
  public Optional<CheckinDevice> findByDeviceId(UUID d){return findByApiKeyHash("");}
  public List<CheckinDevice> findAll(){return List.of();} public List<CheckinDevice> findByEventId(UUID e){return List.of();}
 }
 static class Fixture {
  Repo repo=new Repo(); Devices devices=new Devices(); AtomicInteger qrCalls=new AtomicInteger(); long from=NOW.getEpochSecond()-1, until=NOW.getEpochSecond()+1; boolean invalid=false,voided=false; int max=1;
  SubmitCheckinApplicationService service;
  Fixture(){
   TicketQrVerifier qr=new TicketQrVerifier(){public Optional<VerifiedTicketClaims> verify(String s){qrCalls.incrementAndGet();return invalid?Optional.empty():Optional.of(new VerifiedTicketClaims(T,E,T,from,until,from-1,max));}};
   service=new SubmitCheckinApplicationService(repo,devices,new VoidedTicketCachePort(){public boolean isVoided(UUID id){return voided;} public void upsert(UUID id,String reason,Instant at){}},qr,new ApiKeyHasher());
  }
  SubmitCheckinCommand cmd(UUID key){return new SubmitCheckinCommand("device","signed-fixture",key,NOW);}
  CheckinRecord submit(){return service.submitCheckin(cmd(K));}
 }
 static void concurrent(boolean sameKey)throws Exception {
  Fixture f=new Fixture(); f.repo.parties=80;f.repo.initialReads=new CyclicBarrier(80);
  ExecutorService pool=Executors.newFixedThreadPool(80);List<Future<CheckinRecord>> jobs=new ArrayList<>();long[] durations=new long[80];
  try {
   for(int i=0;i<80;i++){final int n=i;jobs.add(pool.submit(()->{long start=System.nanoTime();try{return f.service.submitCheckin(f.cmd(sameKey?K:new UUID(1,n)));}finally{durations[n]=System.nanoTime()-start;}}));}
   List<CheckinRecord> results=new ArrayList<>();for(var j:jobs)results.add(j.get(20,TimeUnit.SECONDS));
   check(f.repo.accepted==1,"one accepted entry");check(f.repo.rows.size()==(sameKey?1:80),"persisted row count");
   if(sameKey)for(var r:results){check(r.getOutcome()==CheckinOutcome.ACCEPTED,"same outcome");check(r.getIdempotencyKey().equals(K),"same key");check(r.getEntryNo()==1,"same entry");}
   else check(results.stream().filter(r->r.getOutcome()==CheckinOutcome.ACCEPTED).count()==1,"different keys must not all replay");
   System.out.println("LOAD_RAW_NS sameKey="+sameKey+" values="+Arrays.toString(durations));
   Arrays.sort(durations);double p95=durations[75]/1e6;
   System.out.printf(Locale.ROOT,"LOAD tasks=80 sameKey=%s samples=80 p95_ms=%.3f max_ms=%.3f target_ms=2500 target_met=%s rows=%d accepted=%d%n",sameKey,p95,durations[79]/1e6,p95<=2500,f.repo.rows.size(),f.repo.accepted);
  } finally {pool.shutdownNow();check(pool.awaitTermination(10,TimeUnit.SECONDS),"executor terminated");}
 }
 public static void main(String[]args)throws Exception {
  if(args.length>0&&args[0].equals("load")){concurrent(true);concurrent(false);return;}
  List<Task> tests=new ArrayList<>();List<String> names=new ArrayList<>();
  // Full 2x2x2 combinatorial design: replay x device active/revoked x window in/out.
  for(int r=0;r<2;r++)for(int d=0;d<2;d++)for(int w=0;w<2;w++){
   final int replay=r,revoked=d,expired=w;String name="PW"+(r*4+d*2+w+1);names.add(name);
   tests.add(()->{Fixture f=new Fixture();f.devices.status=revoked==1?DeviceStatus.REVOKED:DeviceStatus.ACTIVE;if(expired==1)f.until=NOW.getEpochSecond()-1;
    CheckinRecord old=CheckinRecord.builder().id(99L).ticketId(T).idempotencyKey(K).outcome(CheckinOutcome.ACCEPTED).entryNo(1).build();if(replay==1)f.repo.rows.put(K,old);
    CheckinRecord out=f.submit();CheckinOutcome expected=replay==1?CheckinOutcome.ACCEPTED:revoked==1?CheckinOutcome.DEVICE_REVOKED:expired==1?CheckinOutcome.EXPIRED_WINDOW:CheckinOutcome.ACCEPTED;
    check(out.getOutcome()==expected,name+" expected "+expected);check(f.repo.rows.size()==1,name+" rows");if(replay==1){check(out==old,"exact replay object");check(f.qrCalls.get()==0,"no QR revalidation");check(f.repo.writes==0,"no replay write");}
   });
  }
  names.add("B01_upper_equality");tests.add(()->{Fixture f=new Fixture();f.until=NOW.getEpochSecond();check(f.submit().getOutcome()==CheckinOutcome.ACCEPTED,"upper bound inclusive");});
  names.add("B02_before_start");tests.add(()->{Fixture f=new Fixture();f.from=NOW.getEpochSecond()+1;check(f.submit().getOutcome()==CheckinOutcome.EXPIRED_WINDOW,"before start");});
  names.add("N01_bad_signature");tests.add(()->{Fixture f=new Fixture();f.invalid=true;check(f.submit().getOutcome()==CheckinOutcome.INVALID_SIGNATURE,"invalid QR");check(f.repo.accepted==0,"no accepted entry");});
  names.add("N02_unknown_device");tests.add(()->{Fixture f=new Fixture();f.devices.absent=true;check(f.submit().getOutcome()==CheckinOutcome.DEVICE_NOT_FOUND,"unknown device");});
  names.add("F01_unrelated_constraint_propagates");tests.add(()->{Fixture f=new Fixture();f.repo.fail=true;boolean thrown=false;try{f.submit();}catch(DataIntegrityViolationException e){thrown=true;}check(thrown,"unrelated integrity error must propagate");check(f.repo.rows.isEmpty(),"no fabricated success");});
  names.add("R01_sequential_replay");tests.add(()->{Fixture f=new Fixture();var first=f.submit();var again=f.submit();check(first==again,"same persisted result");check(f.repo.writes==1,"only one write");});
  names.add("C01_80_same_request");tests.add(()->concurrent(true));
  names.add("C02_80_distinct_keys");tests.add(()->concurrent(false));
  if(args.length>0&&args[0].equals("reverse")){Collections.reverse(tests);Collections.reverse(names);}
  for(int i=0;i<tests.size();i++)test(names.get(i),tests.get(i));
  System.out.println("TOTAL passed="+passed);
 }
}
