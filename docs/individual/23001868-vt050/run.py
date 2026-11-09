#!/usr/bin/env python3
"""Dependency-free characterization harness over the actual service. Java 17+."""
from pathlib import Path
import re, shutil, subprocess, sys, tempfile, os, hashlib
ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'backend/ticketing-platform/src/main/java'
PKG='com.ticketing.checkin'
with tempfile.TemporaryDirectory(prefix='vt050-') as tmp:
 out=Path(tmp)
 def put(rel,s):
  f=out/rel; f.parent.mkdir(parents=True,exist_ok=True); f.write_text(s)
 def model(name):
  source=(BASE/('com/ticketing/checkin/domain/model/'+name+'.java')).read_text()
  fields=re.findall(r'private (\w+) (\w+);',source)
  methods=''
  for typ,n in fields:
   cap=n[0].upper()+n[1:]
   methods+=f'public {typ} get{cap}(){{return {n};}} public void set{cap}({typ} v){{{n}=v;}}'
  builder='public static Builder builder(){return new Builder();} public static class Builder { private '+name+' v=new '+name+'();'
  for typ,n in fields: builder+=f'public Builder {n}({typ} x){{v.{n}=x;return this;}}'
  builder+='public '+name+' build(){return v;}}'
  put('com/ticketing/checkin/domain/model/'+name+'.java','package '+PKG+'.domain.model; import java.time.Instant; import java.util.UUID; public class '+name+'{'+''.join('private '+t+' '+n+';' for t,n in fields)+methods+builder+'}')
 for n in ['CheckinRecord','CheckinDevice']: model(n)
 for sub in ['domain/model/CheckinOutcome.java','domain/model/DeviceStatus.java','application/port/AcceptResult.java','application/port/CheckinRecordRepositoryPort.java','application/port/DeviceRepositoryPort.java','application/port/VoidedTicketCachePort.java','application/port/SubmitCheckinCommand.java','application/port/SubmitCheckinUseCase.java','infrastructure/security/VerifiedTicketClaims.java']:
  put('com/ticketing/checkin/'+sub,(BASE/('com/ticketing/checkin/'+sub)).read_text())
 put('com/ticketing/checkin/infrastructure/security/ApiKeyHasher.java','package '+PKG+'.infrastructure.security; public class ApiKeyHasher {public String hash(String s){return s;}}')
 put('com/ticketing/checkin/infrastructure/security/TicketQrVerifier.java','package '+PKG+'.infrastructure.security; import java.util.Optional; public class TicketQrVerifier {public Optional<VerifiedTicketClaims> verify(String s){return Optional.empty();}}')
 put('org/springframework/dao/DataIntegrityViolationException.java','package org.springframework.dao; public class DataIntegrityViolationException extends RuntimeException {public DataIntegrityViolationException(String s){super(s);}}')
 service_path='backend/ticketing-platform/src/main/java/com/ticketing/checkin/application/service/SubmitCheckinApplicationService.java'
 source_ref=os.environ.get('VT050_SOURCE_REF')
 src=subprocess.check_output(['git','show',source_ref+':'+service_path],cwd=ROOT,text=True) if source_ref else (ROOT/service_path).read_text()
 print('SOURCE ref='+str(source_ref or 'working-tree')+' sha256='+hashlib.sha256(src.encode()).hexdigest(),flush=True)
 # Mechanical adapters only: no branch, catch, return, or business condition is rewritten.
 src=re.sub(r'import (lombok\.[^;]+|org.springframework.stereotype.Service);\n','',src)
 src=re.sub(r'^@(Service|RequiredArgsConstructor|Slf4j)\s*$', '',src,flags=re.M)
 src=src.replace('Instant.now()', 'VTClock.now()')
 src=re.sub(r'        log.info\([^;]+;', '',src)
 fields=re.findall(r'private final (\w+) (\w+);',src)
 ctor='public SubmitCheckinApplicationService('+','.join(t+' '+n for t,n in fields)+'){'+''.join('this.'+n+'='+n+';' for t,n in fields)+'}'
 src=src.replace('public class SubmitCheckinApplicationService implements SubmitCheckinUseCase {','public class SubmitCheckinApplicationService implements SubmitCheckinUseCase {'+ctor)
 put('com/ticketing/checkin/application/service/SubmitCheckinApplicationService.java',src)
 put('com/ticketing/checkin/application/service/VTClock.java','package '+PKG+'.application.service; public class VTClock { public static java.time.Instant now(){return java.time.Instant.parse("2026-11-09T12:00:00Z");}}')
 put('com/ticketing/checkin/application/service/Harness.java',Path(__file__).with_name('Harness.java').read_text())
 files=[str(x) for x in out.rglob('*.java')]
 compiler=['javac'] if shutil.which('javac') else ['java','-m','jdk.compiler/com.sun.tools.javac.Main']
 subprocess.run(compiler+['-d',str(out/'classes')]+files,check=True)
 subprocess.run(['java','-cp',str(out/'classes'),PKG+'.application.service.Harness']+sys.argv[1:],check=True)
