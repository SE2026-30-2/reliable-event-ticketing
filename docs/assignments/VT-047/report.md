01 / Specification &amp; phạm vi



BÀI TẬP CÁ NHÂN 3 - VT-047Vũ Quang Anh · MSSV 23001831 · SE2026-T12 · Thành viênAPP-07 - Reliable Event Ticketing với QR check-in

Repository: SE2026-30-2/reliable-event-ticketingBranch: assignment/bt3-23001831-vt047Baseline: c6465af9722eddea6645181342e5b9fb059c845f

Đề PDF ghi BT3/VT-047 dù tên file nguồn chứa AD-047-3. Repository trong đề trả 404; sinh viên đã xác nhận dùng repository APP-07 trên đây ngày 06/11/2026. Bài không khẳng định hai repository là cùng một repository.

Problem statement

Ban tổ chức cần tải lịch sử check-in của sự kiện để đối soát. Endpoint mới phải chỉ cho ADMIN hoặc ORGANIZER sở hữu sự kiện truy cập, không lẫn dữ liệu sự kiện khác, và không trả CSV thành công khi truy vấn thất bại. Chọn một lát cắt chạy được: GET /api/manage/events/{eventId}/checkins.csv.

AC | Điều kiện chấp nhận

AC1 | Khách chưa đăng nhập: 401; USER: 403; ORGANIZER khác chủ hoặc event không tồn tại: 404. Chủ sự kiện và ADMIN được tải.

AC2 | CSV chỉ gồm bản ghi có event_id đúng yêu cầu, mọi outcome; thứ tự server_received_at rồi id; ticket/device NULL thành ô trống.

AC3 | HTTP 200 có UTF-8/BOM, header cột cố định, attachment checkins-{UUID}.csv, Cache-Control: no-store; event rỗng chỉ có header.

AC4 | Hai export cùng event chồng nhau trong một JVM: tác vụ sau nhận 409; event khác không bị chặn; retry sau hoàn thành được phép, không ghi DB.

AC5 | Lỗi SQL: 503, không attachment/CSV thành công, không lộ SQL; lỗi SQL hoặc Writer đều giải phóng guard để lần sau chạy được.

Invariant: mọi dòng được xuất thuộc event đã được kiểm tra quyền; tối đa một lần tạo CSV của mỗi event đang hoạt động trong một JVM. Auth được kiểm tra trước truy vấn và trước giữ guard.

NFR1: 120 tác vụ đồng thời, p95 ≤ 3.5 giây trên harness đã khai báo. NFR2: không thêm dependency, không đổi migration, không xuất detail/PII; negative path không trả dữ liệu CSV. Giới hạn: buffer trong RAM; không đảm bảo event lớn hoặc nhiều instance.

Cam kết theo yêu cầu (sinh viên xác nhận trước khi nộp): “Tôi chịu trách nhiệm về toàn bộ code, test và nội dung bài làm; tôi đã khai báo việc sử dụng AI.”

02 / AI-assisted plan &amp; review



Plan được ghi trước khi sửa production code

Prompt tác vụ cho Codex: “Tạo lát cắt check-in CSV theo event; viết test fail trước; dùng security, CsvWriter và JDBC hiện có; kiểm tra quyền, phạm vi, NULL, lỗi SQL và concurrent export; không thêm dependency hoặc sửa migration; review diff, mutation bỏ guard và đo 120 tác vụ.” Prompt/assumption chi tiết nằm trong plan.md.

Đề xuất ban đầu | Evidence trong baseline | Quyết định

Thêm attendees.csv mới | ReportController đã có attendees.csv và payments.csv; docs/api/ticketing-platform.md mô tả contract. | Bác bỏ trùng chức năng; thêm checkins.csv.

Mock JdbcTemplate đủ chứng minh DB | V4__add_checkin.sql cho phép ticket_id/device_id NULL, server_received_at TIMESTAMPTZ. | Bác bỏ; chạy SQL thật trên H2; ghi rõ chưa chứng minh PostgreSQL.

Mọi từ chối trả 403 | EventAccessApplicationService.assertCanManage ném EventNotFoundException. | Giữ 404 cho event lạ/khác chủ; 403 chỉ ở role gate.

Stream trực tiếp rồi báo lỗi SQL | Endpoint CSV cũ dùng StreamingResponseBody; có thể đã gửi HTTP 200 trước lỗi query. | Buffer lát cắt nhỏ trước khi trả 200; SQL lỗi được map 503.

Scope và file dự kiến thay đổi

Production: reporting/application/EventReportService.java thêm query và guard; reporting/web/ReportController.java thêm route, quyền, response/error mapping. Test: CheckinExportApiTest.java, CheckinExportContractTest.java; tái dùng CsvWriterTest. Tài liệu: API, README, plan, AI review, evidence. Các đường dẫn Java nằm dưới backend/ticketing-platform/src/.

Assumptions được công khai

ADMIN quản lý mọi event tồn tại; ORGANIZER được so email không phân biệt hoa thường theo code hiện có. event_id NULL không thuộc phạm vi event cụ thể và bị loại. Các lần tải tuần tự hợp lệ; guard là chống chạy chồng, không phải cache idempotency bền vững. H2 là dependency đã có; fixture chỉ chiếu các cột dùng bởi query.

Cơ sở phương pháp: Lecture 06, slide 9-14 (spec/plan/context), 17-18 (diff và nhiều nguồn evidence), 21-23 (branch, truy vết, review trước merge). Nội dung slide được dùng làm quy trình, không làm bằng chứng code đúng.

03 / Risk strategy &amp; decision table



Risk | Mức ưu tiên / phương án

R1 - lộ dữ liệu event khác | P0: security chain + policy thật, hai event A/B cùng schema; assert body, không chỉ status.

R2 - mock che contract DB sai | P0: JdbcTemplate và H2 thật; NULL UUID, timestamp, alias cột, query sai/schema thiếu cột. PostgreSQL/Flyway còn thiếu.

R3 - mất guard, chạy chồng | P0: latch giữ writer đầu; lần thứ hai phải bị từ chối; mutation xóa guard để kiểm tra oracle.

R4 - CSV hỏng/lỗi giả thành công | P1: BOM, tên file, cột/thứ tự, ô trống; 503 khi thiếu cột; Writer ném lỗi rồi retry.

R5 - hiệu năng và flaky | P1: 120 worker, 3 đợt; dữ liệu cố định; random order có seed và đổi múi giờ.

Decision table: áp dụng theo thứ tự từ trên xuống

Rule | JWT / role | Event &amp; chủ | Guard / DB | Kết quả / case

D1 | Không | - | - | 401 / T01

D2 | Có / USER | - | - | 403 / T02

D3 | ADMIN hoặc ORG | Không tồn tại | - | 404 / T06

D4 | ORG | Tồn tại, khác chủ | - | 404 / T04

D5 | ORG chủ hoặc ADMIN | Tồn tại | Bận / - | 409 / T12, T17

D6 | ORG chủ hoặc ADMIN | Tồn tại | Rảnh / SQL lỗi | 503 / T08, T14

D7 | ORG chủ hoặc ADMIN | Tồn tại | Rảnh / DB OK | 200 / T03, T05, T09-11

Dấu “-” = không ảnh hưởng vì rule trước đã quyết định. UUID sai được binding từ chối 400 (T07), ngoài bảng boolean. Chọn A do owner@test.invalid sở hữu, B do other@test.invalid; dùng OWNER viết hoa để kiểm tra normalization. Mỗi event có marker UUID riêng để bắt rò rỉ; thêm NULL, event rỗng, timestamp bằng nhau để kiểm tra tie-break id.

Phân bổ test level

Unit: CsvWriterTest kiểm tra escape/formula/BOM. Integration/API: MockMvc chạy controller, security và policy thật; event lookup/JWT là doubles được khai báo; JDBC chạy H2 thật. E2E dự kiến: đăng nhập organizer A → tải CSV → kiểm nội dung A; dùng URL B → bị từ chối. Chưa chạy browser/identity/HTTP thật.

Không cần cho lát cắt: E2E thanh toán VNPay, gửi mail, QR camera và lặp lại mọi tổ hợp trình duyệt; không đổi các luồng này. Không mock JDBC để thay cho contract tests. PostgreSQL integration là test tiếp theo có giá trị cao nhất.

04 / Danh mục test cases



API = MockMvc + security/policy + JDBC/H2; INT = service + JDBC/H2; P0 bảo vệ quyền/phạm vi/concurrency. Tất cả case dưới đây đã chạy pass trên nhánh phục hồi guard. T16 chạy bằng cờ riêng.

ID | AC/Risk | Level | Precondition / input | Expected result | Ưu tiên

T01 | AC1/R1 | API | Không JWT; A | 401, không CSV | P0

T02 | AC1/R1 | API | USER; A | 403, không CSV | P0

T03 | AC1-3/R1 | API | ORG chủ A, email HOA; A/B có dữ liệu | 200; đúng dòng A/BOM/headers; không B | P0

T04 | AC1/R1 | API | ORG chủ A yêu cầu B | 404 | P0

T05 | AC1-2/R1 | API | ADMIN yêu cầu B | 200; chỉ B, không A | P0

T06 | AC1/R1 | API | ADMIN; event không có | 404 | P0

T07 | AC1/R1 | API | ADMIN; UUID invalid | 400 | P1

T08 | AC5/R2 | API | Bỏ cột outcome trong H2 | 503; không attachment/SQL leak | P0

T09 | AC3/R4 | INT | Event không có bản ghi | Chỉ BOM + header | P1

T10 | AC2/R2 | INT | A/B/NULL event; ticket NULL; giờ bằng nhau | Dòng A đúng thứ tự id; NULL trống | P0

T11 | AC4/R3 | INT | Cùng event tải hai lần tuần tự | CSV bằng nhau, count DB không đổi | P1

T12 | AC4/R3 | INT | Writer 1 giữ bằng latch; export 2 cùng A | ExportBusyException; retry sau đó OK | P0

T13 | AC5/R4 | INT | Writer ném IOException | UncheckedIOException; retry OK | P1

T14 | AC5/R2 | INT | Đổi tên cột rồi khôi phục | SQL failure; guard thả; retry OK | P0

T15 | AC4/R3 | INT | A đang giữ guard, xuất B | B hoàn thành bình thường | P1

T16 | NFR1/R5 | Load | 120 event × 50 dòng; 120 worker × 3 đợt | 360 đúng output; p95 ≤ 3500 ms | P1

T17 | AC4/R3 | API | Giữ export A; gọi HTTP A | 409; không attachment | P0

Bổ sung 5 CsvWriterTest có sẵn: giữ test định dạng CSV thay vì sao chép chúng vào bộ mới. E2E nêu ở trang 3 là kế hoạch chưa thực thi, không cộng vào số pass.

05 / Test-first &amp; mutation evidence



Mốc | Commit / log | Kết quả và ý nghĩa

Baseline | c6465af | Chưa có route checkins.csv. Giữ nguyên workspace gốc; dùng worktree riêng.

RED | b8d107b; plan/evidence: 535abd2; red.log | 8 test, 4 fail, 0 error. T03/T05 mong 200 nhưng 404; T07 mong 400, T08 mong 503 nhưng 404. Không dùng lỗi build làm RED.

Patch / GREEN | 770d708; green-confirmed.log | 2 production files, 50 dòng thêm; 21/21 test pass (8 API + 8 contract/load + 5 CSV).

Mutation | b15e9b2; mutation.log | Nhánh experiment/vt047-remove-export-guard bỏ atomic add/check; T12 fail: “Expecting code to raise a throwable.”

Restore / regression | 2a75bf0; verify.log | Quay lại nhánh có guard, thêm T17 cho HTTP 409. Maven verify: 193 test, 0 fail/error/skip; JaCoCo report thành công.

Vì sao mutation bị phát hiện?

Writer đầu tiên báo đã vào vùng giữ guard rồi chờ latch. Tác vụ thứ hai gọi cùng event trong khoảng đó. Bản đúng phải ném ExportBusyException; mutant chạy tiếp nên assertion thất bại. finally mở latch và kết thúc executor ngay cả khi assertion fail. Đây là mutation bỏ concurrency guard đúng biến thể, không phải bỏ filter quyền hay sửa expected result.

Mutation nằm trong commit/nhánh thí nghiệm riêng, không là tổ tiên của nhánh nộp. Bản diff mutation được lưu cùng evidence để xem lại; không merge nhánh thí nghiệm.

Lệnh tái lập chính (từ backend/ticketing-platform)

.\mvnw.cmd -B -ntp "-Dtest=CheckinExport*Test,CsvWriterTest" "-Dvt047.load=true" test.\mvnw.cmd -B -ntp org.jacoco:jacoco-maven-plugin:0.8.12:prepare-agent "-Dvt047.load=true" verify org.jacoco:jacoco-maven-plugin:0.8.12:report

Review diff trước chấp nhận

Scope chỉ reporting, test và docs; quyền được kiểm tra trước SQL; query dùng parameter event_id; CSV dùng formatter sẵn có; dữ liệu NULL không đưa vào List.of; finally thả guard cho cả SQL/Writer failure. Không sửa auth, schema, dependencies hoặc các API CSV cũ. Review do AI thực hiện được khai báo; nhóm chưa review/merge.

Một lỗi môi trường ban đầu là không ghi được cache Maven .m2; log environment-initial.log được giữ riêng. Hai lần chạy sandbox bị kẹt không được tính pass. Các con số trên lấy từ các lần chạy hoàn tất.

06 / Coverage, flaky &amp; performance



Đơn vị đo JaCoCo | Line | Branch / giới hạn

ReportController.checkins | 12/12 | Không có branch counter; catch không được tính như if.

EventReportService.writeCheckinsCsv | 10/10 | 2/2 nhánh guard đã chạy.

Lambda ghi dòng của writeCheckinsCsv | 5/7 | Còn 2 dòng catch IOException khi ghi dữ liệu chưa chạy; T13 lỗi ở đầu Writer, không chứng minh nhánh này.

Coverage trên là của method mới, không phải 100% toàn ứng dụng. Không cộng line method/lambda để suy ra source line tổng vì có thể trùng. Mutation + scope assertion + failure/retry cung cấp evidence độc lập; line coverage không chứng minh schema PostgreSQL hay auth JWT thật.

Flaky review và kiểm tra thực tế

Time: timestamp fixture cố định 2026-01-01T00:00:00Z; không assert đồng hồ hiện tại. Chạy UTC, Asia/Ho_Chi_Minh, America/New_York. Order/shared state: mỗi contract test có DB tên riêng; API test reset bảng trước mỗi case; chạy random order seed 4701/4702/4703. Concurrency: dùng latch có timeout + Future.get và cleanup finally, không sleep. Các test API không bật parallel vì dùng chung fixture reset.

Ba lần kiểm tra order/timezone: 17 test/lần, 0 fail/error, 1 skip/lần (T16 cố ý tắt); 48 lượt functional test thực thi thành công. Đây là kiểm tra hữu hạn, không phải chứng minh tuyệt đối không flaky. Network/JWT thật chưa được đưa vào harness.

120 tác vụ đồng thời: thí nghiệm thực thi

Tham số | Giá trị

Môi trường | Windows, Java 21.0.1; JDBC/H2 in-memory, một service instance; không HTTP/network.

Dữ liệu | 120 event độc lập × 50 dòng/event = 6.000 dòng; UUID cố định, outcome ACCEPTED; có index PK id, không index event_id trong fixture.

Cách đo | 120 thread sẵn sàng tại barrier rồi mở start gate; 3 đợt, 360 mẫu; 1 warm-up bỏ khỏi mẫu. Đo từ lúc mở gate đến kiểm xong CSV, gồm scheduling/query/serialize/assert.

Kết quả không instrumentation | p95 = 193.118 ms; max = 198.185 ms; 360/360 output đúng, 0 lỗi; p95 thấp hơn mục tiêu 3500 ms.

Cách tính | Sắp xếp 360 duration; nearest-rank ceil(0.95 × 360) = mẫu thứ 342. Toàn bộ samples trong load.json.

Kết luận có giới hạn: đạt mục tiêu trên harness/dataset này. Không suy ra SLO production, event lớn, pool PostgreSQL, truyền file qua mạng hoặc 120 request cùng event. Tranh cùng event được kiểm tra riêng bằng T12/T17; nhiều JVM cần guard chia sẻ.

07 / Traceability &amp; AI review



Ký hiệu file: A = src/test/java/com/ticketing/reporting/web/CheckinExportApiTest.java; C = src/test/java/com/ticketing/reporting/application/CheckinExportContractTest.java; W = CsvWriterTest.java cùng thư mục application. Các file dưới backend/ticketing-platform/.

Requirement / risk | Case → file | Commit / evidence / kết quả

AC1 / R1: quyền và ẩn event | T01-07 → A | b8d107b RED; 770d708 GREEN; verify.log pass.

AC2 / R1,R2: scope, SQL/NULL | T03,T05 → A; T10 → C | 770d708; green-confirmed.log và verify.log pass.

AC3 / R4: format/empty | T03 → A; T09 → C; W | 770d708; body/header/empty và 5 CSV tests pass.

AC4 / R3: guard/retry/read-only | T11,T12,T15 → C; T17 → A | 770d708 + 2a75bf0 (T17); mutant b15e9b2 bị T12 bắt; verify.log pass sau restore.

AC5 / R2,R4: failure/recovery | T08 → A; T13,T14 → C | 770d708; SQL thật bị phá schema; retry sau phục hồi pass.

NFR1 / R5: tải | T16 → C | 770d708; load.json: 360 sample, 0 lỗi, p95 đạt trên harness.

NFR2 / R1,R4: phạm vi patch | T03,T08,T17 → A; diff | Không thêm dependency/migration; body export chỉ 5 cột; diff đã review.

AI review bắt buộc sau khi test pass

Nhận xét có evidence: guard phải được giải phóng khi query hoặc Writer lỗi, nếu không event bị khóa vĩnh viễn. Đồng ý: finally trong diff và T13/T14 chứng minh fail rồi retry thành công. Nhận xét không đủ evidence: “H2 pass và p95 thấp chứng minh PostgreSQL production đạt 3.5 giây”. Bác bỏ: chưa có PostgreSQL, HTTP, pool thực tế hay JWT thật. Phân tích và phản biện này là bản thảo AI để sinh viên tự kiểm tra.

Hai điều trông hợp lý nhưng chưa đáng tin

1. Chỉ assert 404 cho event khác chủ có thể pass dù endpoint chưa tồn tại: T04/T06 đã pass ở RED. Phải kèm positive path T03/T05 và kiểm body/header.2. Mock JDBC trả đúng bản ghi, hoặc gọi H2 fixture là “schema production”, có thể che lỗi cột, NULL, migration và transaction. Dùng SQL thật và failure path làm giảm rủi ro; không xóa giới hạn PostgreSQL.

Code, lịch sử nhánh nộp và log truy cập từ branch bài làm; mutant chỉ có ở nhánh local, diff được lưu trong evidence/mutation.patch để tái lập. README cung cấp lệnh chạy. Branch chưa merge. AI Usage Log ở phụ lục A.

08 / Reflection &amp; tài liệu tham chiếu



Reflection (323 từ theo tách khoảng trắng)Bản thảo dựa trên evidence thực thi; sinh viên cần đọc, điều chỉnh theo nhận thức cá nhân và xác nhận trước khi nộp.

Confidence tăng lên khi bằng chứng đi qua một vòng lặp có thể tái hiện. Trước patch, các test tải hợp lệ nhận 404 thay vì 200, nên thất bại gắn với chức năng còn thiếu. Sau patch, việc kiểm tra cả nội dung CSV, header và dữ liệu của hai sự kiện có giá trị hơn chỉ nhìn trạng thái thành công.

Thí nghiệm mutation là bằng chứng quan trọng nhất cho guard. Khi bỏ thao tác kiểm tra nguyên tử, test concurrency thất bại vì lần xuất thứ hai vẫn chạy. Latch tạo khoảng chồng lấn xác định, giúp kết quả ít phụ thuộc tốc độ máy. Các test lỗi schema và lỗi Writer còn kiểm tra khả năng phục hồi, không chỉ phát hiện ngoại lệ.

Tuy vậy, confidence vẫn có ranh giới. H2 thực thi query thật nhưng schema thử nghiệm chỉ gồm những cột cần dùng. Nó không thay thế PostgreSQL với Flyway, driver, pool và transaction thực tế. JWT được đưa vào test bằng tiện ích kiểm thử; chưa có bằng chứng cho toàn bộ luồng đăng nhập và tải file qua mạng. Số p95 thấp chỉ mô tả dữ liệu nhỏ trong một tiến trình. Buffer có thể tốn bộ nhớ với lịch sử lớn, còn guard không điều phối nhiều instance.

Bài học khi dùng AI là kiểm tra cả oracle và lời giải thích. Một test 404 có vẻ bảo vệ phân quyền nhưng vẫn pass khi route chưa tồn tại. Một kết luận hiệu năng có vẻ thuyết phục nhưng vượt quá môi trường đã đo. Test tiếp theo có giá trị cao nhất là chạy endpoint với PostgreSQL thật, áp dụng migration của dự án, tạo hai chủ sự kiện và kiểm tra phạm vi dữ liệu qua HTTP. Sau đó cần đo tải với pool giới hạn và dữ liệu lớn hơn trước khi đề nghị nhóm review và triển khai.

Nguồn và phạm vi evidence

1. Đề BT cá nhân 3 - APP-07 - VT-047, email ngày 29/10/2026, trang 1-3: change request, risk mock/DB, decision table, mutation, tải và đầu ra.2. Lecture_06_AI_Assisted_Software_Development_and_Vibe_Coding_v3.pptx: slide 9-14, 17-18, 21-23.3. Lecture_07_Software_Testing_and_Quality_Engineering.pptx: slide 7-12, 16-23, 26: risk, test level, data, coverage, flaky, mutation. Decision table được áp dụng theo yêu cầu riêng của đề, không gán nhầm là nội dung cụ thể của slide.4. Repository tại baseline và các commit được dẫn: ReportController, EventReportService, CsvWriter, EventAccessApplicationService, ManagementEndpointsSecurityTest; migrations V4 và V8. Evidence chạy máy ngày 06/11/2026 (Asia/Saigon).

Trạng thái bàn giao: có code/test/README/log và PDF; chưa merge, chưa nộp Classroom. Chưa thực thi PostgreSQL/Flyway integration, browser E2E, HTTP load hoặc triển khai nhiều instance. Sinh viên chịu trách nhiệm kiểm tra bài và cam kết cá nhân.

Phụ lục A / AI Usage Log



Công cụ: Codex trong ứng dụng desktop; hỗ trợ đọc slide/PDF, lập plan, sinh Java/JUnit, chạy Maven, review diff, tổng hợp PDF. Không dùng subagent. Nội dung dưới đây tách prompt tác vụ do agent diễn giải khỏi yêu cầu gốc của người dùng.

Bước / prompt chính | Output sử dụng | Sửa/bác bỏ &amp; evidence

Người dùng: “Đọc các slide và hoàn thành các yêu cầu ... AD-047-3”. | Đọc nội dung PDF: thực tế là BT3/VT-047; trích Lecture 06/07. | Dùng mã VT-047 và filename BT3; người dùng xác nhận repo reliable-event-ticketing.

Agent plan: tạo export nhỏ, test-first, reuse auth/JDBC, không dependency mới. | plan.md; scope 2 production files + 2 test files. | Bác attendees trùng; bác JDBC mock làm evidence DB; sửa 403 thành 404 theo policy.

Agent test generation: owner/admin/foreign, NULL, malformed UUID, failure schema. | CheckinExportApiTest; red.log. | Không coi lỗi cache Maven là fail chức năng; chạy lại có 4 assertion fail đúng nguyên nhân.

Agent implementation: guard atomic theo event, CSV query scope, buffer rồi response. | 770d708; green-confirmed.log: 21 pass. | Không dùng List.of cho NULL; không stream 200 trước khi SQL xong; giữ CSV formatter cũ.

Agent review sau pass: challenge scope, SQL, quyền, concurrency, performance claims. | ai-review.md; T17 bổ sung HTTP 409. | Chấp nhận cảnh báo cleanup guard theo T13/T14; bác claim PostgreSQL/SLO từ H2; giới hạn RAM/one-JVM còn lại.

Agent mutation: bỏ concurrency guard, chạy T12, restore. | b15e9b2; mutation.log; mutation.patch. | T12 bắt lỗi; mutant ở nhánh thí nghiệm, không merge vào bài.

Agent verification: full verify + JaCoCo, load và flaky order/timezone. | verify.log: 193 pass; load.json; jacoco.xml; flaky logs. | Không báo coverage toàn app = 100%; khai báo lambda 5/7 và projected schema.

Agent report: tạo PDF 8 trang chính + phụ lục. | build_report.py; PDF; bản Markdown để chỉnh. | Reflection/cam kết là bản thảo để sinh viên review; không giả định đã có phê duyệt của nhóm.

Các prompt kỹ thuật trên là chỉ dẫn tác vụ được Codex ghi lại trong quá trình làm việc, không giả danh lời nhắn do sinh viên tự gõ. Các quyết định review trong báo cáo là phân tích của AI có evidence; sinh viên cần tự kiểm tra và có thể sửa/bác bỏ trước khi nộp.

Phụ lục B / Log &amp; cách kiểm chứng



Trích log thực thi (đầy đủ trong repository)

Log | Trích kết quả

red.log | Tests run: 8, Failures: 4, Errors: 0, Skipped: 0<br/>T03/T05: expected 200 but was 404; T07: 400/404; T08: 503/404.

green-confirmed.log | Tests run: 21, Failures: 0, Errors: 0, Skipped: 0<br/>BUILD SUCCESS

mutation.log | T12_overlappingSameEventRejectedThenRetrySucceeds<br/>Expecting code to raise a throwable.<br/>Tests run: 1, Failures: 1, Errors: 0

verify.log | Tests run: 193, Failures: 0, Errors: 0, Skipped: 0<br/>JaCoCo: Analyzed bundle with 210 classes; BUILD SUCCESS

load.json | workers=120; rounds=3; samples=360; errors=0<br/>p95ms=193.1177; maxMs=198.1849

flaky-4701/4702/4703.log | Mỗi lần: 17 test, 0 failure/error, 1 skip do load opt-in.<br/>Seed khác nhau và ba múi giờ; BUILD SUCCESS.

Hướng dẫn review

Mở README của bài để chạy lại. RED commit chứa test nhưng chưa có implementation; checkout commit riêng bằng worktree để không đụng branch hiện tại. Mutation chỉ bỏ ba dòng guard; áp dụng patch ở worktree thử nghiệm rồi chạy T12, sau đó bỏ worktree thử nghiệm. Không chạy/merge mutant trên branch nộp.

Log load không instrumentation được dùng làm số đo chính. load-instrumented.json là lần đo trong Maven verify có JaCoCo, được giữ riêng để không trộn hai điều kiện đo. jacoco.xml chứa counter gốc; coverage-summary.json chỉ là bản trích.

Các giới hạn cần giữ khi trình bày

H2 thật không phải PostgreSQL thật. MockMvc không phải E2E mạng. ROLE/JWT của test không chứng minh kiểm tra chữ ký và JWKS của identity-service. Lookup event được mock nhưng policy EventAccessApplicationService là code thật. Lát cắt không giải quyết memory bound hay multi-instance guard. Không sử dụng số pass hoặc coverage đơn độc làm chứng minh tuyệt đối.

Mã nguồn và test có thể chạy là evidence chính; PDF/log không thay thế repository. Không có thay đổi frontend/mobile; chưa merge. Người dùng tự nộp PDF và branch vào Assignment “Bài tập cá nhân 3” sau khi đọc lại.
