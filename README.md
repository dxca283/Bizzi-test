# 🧾 Electronic Invoice Management System (Bizzi Backend Test)

Hệ thống Quản lý và Phát hành Hóa đơn Điện tử được xây dựng với **Node.js**, **TypeScript**, **Express 5**, **Prisma ORM 7**, **PostgreSQL** và **PDFKit**.

---

## 📑 Mục lục
1. [Mô tả dự án](#-1-mô-tả-dự-án)
2. [Thiết kế Cơ sở dữ liệu (Database Schema)](#-2-thiết-kế-cơ-sở-dữ-liệu-database-schema)
3. [Danh sách API Endpoints](#-3-danh-sách-api-endpoints)
4. [Hướng dẫn cài đặt & Cách chạy](#-4-hướng-dẫn-cài-đặt--cách-chạy)
5. [Kiến thức học được & Best Practices](#-5-kiến-thức-học-được--best-practices)

---

## 🚀 1. Mô tả dự án

Dự án mô phỏng nghiệp vụ thực tế của một hệ thống **Quản lý Hóa đơn Điện tử (E-Invoice)** theo đúng quy trình tài chính:

* **Quản lý vòng đời Hóa đơn (State Machine)**: Hóa đơn chuyển trạng thái qua các bước `DRAFT` (Bản nháp) $\rightarrow$ `ISSUED` (Đã phát hành) $\rightarrow$ `CANCELED` (Đã hủy).
* **Nghiệp vụ Thay thế Hóa đơn (Invoice Replacement)**: Hóa đơn đã phát hành nếu có sai sót sẽ không được sửa trực tiếp; thay vào đó, hệ thống sẽ thực hiện **Hủy hóa đơn cũ** và **Tạo hóa đơn mới thay thế** được liên kết nguồn gốc trong một giao dịch an toàn (Database Transaction).
* **Tự động sinh mã hóa đơn**: Tự động tăng tuần tự theo định dạng `INV-000001`, `INV-000002`,...
* **Tính toán tài chính chuẩn xác**: Tự động tính `subtotal`, `tax`, `total` dựa trên danh sách món hàng (`quantity`, `unitPrice`) và thuế suất (`taxRate`).
* **Xuất hóa đơn PDF**: Hỗ trợ xem và tải hóa đơn bản in chuẩn PDF A4 với giao diện chuyên nghiệp bằng `PDFKit` (stream trực tiếp về client).
* **Validation & Error Handling**: Xác thực dữ liệu đầu vào chặt chẽ bằng `Zod`, xử lý lỗi tập trung qua Custom `AppError` và Global Error Handler Middleware.

### 🛠️ Tech Stack
* **Runtime / Language**: Node.js (ES Module), TypeScript
* **Framework**: Express 5
* **ORM & Database**: Prisma ORM 7 + `@prisma/adapter-pg`, PostgreSQL 16
* **Validation**: Zod
* **PDF Engine**: PDFKit
* **Containerization**: Docker Compose
* **Dev Tools**: `tsx` (TypeScript Execution Engine)

---

## 🗄️ 2. Thiết kế Cơ sở dữ liệu (Database Schema)

### 📊 Sơ đồ quan hệ thực thể (ERD)

```mermaid
erDiagram
    Invoice ||--o{ InvoiceItem : "chứa (1 - n)"
    Invoice ||--o{ Invoice : "thay thế cho (replacedInvoice - 1 - n)"

    Invoice {
        String id PK "UUID"
        String invoiceNumber UK "Mã hóa đơn (INV-XXXXXX)"
        InvoiceStatus status "DRAFT | ISSUED | CANCELED"
        String customerName "Tên khách hàng"
        String customerEmail "Email khách hàng (nullable)"
        Decimal subtotal "Tổng tiền trước thuế (15,2)"
        Decimal tax "Tiền thuế (15,2)"
        Decimal total "Tổng tiền thanh toán (15,2)"
        DateTime issuedAt "Thời điểm phát hành"
        DateTime canceledAt "Thời điểm hủy"
        String replacedInvoiceId FK "ID hóa đơn bị thay thế (nullable)"
        DateTime createdAt "Ngày tạo"
        DateTime updatedAt "Ngày cập nhật"
    }

    InvoiceItem {
        String id PK "UUID"
        String invoiceId FK "Khóa ngoại tham chiếu Invoice"
        String description "Mô tả sản phẩm/dịch vụ"
        Decimal quantity "Số lượng (15,2)"
        Decimal unitPrice "Đơn giá (15,2)"
        Decimal amount "Thành tiền (15,2)"
        DateTime createdAt "Ngày tạo"
    }
```

### 🔍 Chi tiết các bảng & Ràng buộc toàn vẹn:

1. **Enum `InvoiceStatus`**:
   * `DRAFT`: Bản nháp, cho phép chỉnh sửa hoặc xóa hẳn khỏi hệ thống.
   * `ISSUED`: Hóa đơn đã phát hành chính thức, không thể sửa/xóa trực tiếp, chỉ có thể Hủy hoặc Thay thế.
   * `CANCELED`: Hóa đơn đã bị hủy bỏ, lưu vết thời điểm `canceledAt`.

2. **Bảng `Invoice`**:
   * `invoiceNumber`: Trường `UNIQUE` đánh dấu mã hóa đơn.
   * `replacedInvoiceId`: Khóa ngoại tự tham chiếu (**Self-relation**) liên kết hóa đơn mới với hóa đơn gốc bị thay thế, phục vụ việc truy vết lịch sử hóa đơn (Audit Trail).
   * **Index**: Đánh chỉ mục trên `status` và `replacedInvoiceId` giúp tối ưu tốc độ truy vấn danh sách và báo cáo.

3. **Bảng `InvoiceItem`**:
   * Lưu các dòng chi tiết hàng hóa/dịch vụ.
   * Ràng buộc `onDelete: Cascade`: Khi xóa hóa đơn nháp (Draft), toàn bộ items liên quan sẽ tự động được dọn dẹp sạch sẽ.
   * Kiểu dữ liệu số tiền: Sử dụng `Decimal(15, 2)` để tránh sai số dấu phẩy động (floating-point precision issues).

---

## 🔌 3. Danh sách API Endpoints

Base URL: `http://localhost:3000/api/invoices`

| Method | Endpoint | Chức năng | Trạng thái áp dụng | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/invoices` | Tạo hóa đơn nháp | Mới $\rightarrow$ `DRAFT` | Tự sinh mã `INV-xxxxxx`, tính toán tiền hàng & thuế |
| `GET` | `/api/invoices` | Danh sách hóa đơn | Tất cả | Hỗ trợ phân trang `?page=1&limit=20` & lọc `?status=ISSUED` |
| `GET` | `/api/invoices/:id` | Chi tiết hóa đơn | Tất cả | Tìm theo `id` (UUID) hoặc `invoiceNumber`, kèm items & liên kết thay thế |
| `PATCH` | `/api/invoices/:id` | Cập nhật hóa đơn | `DRAFT` | Sửa thông tin khách hàng, items, tự động tính lại tổng tiền |
| `DELETE` | `/api/invoices/:id` | Xóa hóa đơn | `DRAFT` | Xóa vĩnh viễn hóa đơn nháp cùng toàn bộ items |
| `POST` | `/api/invoices/:id/issue` | Phát hành hóa đơn | `DRAFT` $\rightarrow$ `ISSUED` | Chốt hóa đơn chính thức, ghi nhận `issuedAt` |
| `POST` | `/api/invoices/:id/cancel` | Hủy hóa đơn | `DRAFT`/`ISSUED` $\rightarrow$ `CANCELED` | Hủy hóa đơn, ghi nhận `canceledAt` |
| `POST` | `/api/invoices/:id/replace` | Thay thế hóa đơn | `ISSUED` $\rightarrow$ Hóa đơn mới | Hủy hóa đơn cũ và tạo hóa đơn mới liên kết trong 1 Transaction |
| `GET` | `/api/invoices/:id/pdf` | Tải file PDF hóa đơn | Tất cả | Xuất file PDF A4 chuẩn đẹp mắt |

---

## 💻 4. Hướng dẫn cài đặt & Cách chạy

### 📋 Yêu cầu môi trường
* [Node.js](https://nodejs.org/) (phiên bản 18+ hoặc 20+)
* [Docker & Docker Compose](https://www.docker.com/) (để chạy PostgreSQL)

---

### Bước 1: Khởi chạy Database với Docker Compose

Khởi chạy PostgreSQL container chạy ở cổng `5432`:

```bash
docker compose up -d
```

> Kiểm tra container đang chạy: `docker ps`

---

### Bước 2: Cài đặt Dependencies

```bash
npm install
```

---

### Bước 3: Cấu hình biến môi trường (`.env`)

Để đảm bảo an toàn bảo mật, file `.env` thực tế đã được cấu hình trong [`.gitignore`](file:///.gitignore) và **không bao giờ bị đẩy lên Git repository**.

Dự án cung cấp sẵn file mẫu [`.env.example`](file:///.env.example). Bạn hãy sao chép file này thành `.env`:

```bash
# Trên Linux/macOS
cp .env.example .env

# Trên Windows (PowerShell)
Copy-Item .env.example .env

# Trên Windows (CMD)
copy .env.example .env
```

Các biến môi trường mặc định phục vụ chạy local Docker:
```env
DATABASE_URL="postgresql://invoice_user:invoice_password@localhost:5432/invoice_db?schema=public"
PORT=3000

POSTGRES_USER=invoice_user
POSTGRES_PASSWORD=invoice_password
POSTGRES_DB=invoice_db
```


---

### Bước 4: Chạy Database Migration & Sinh Prisma Client

Dự án sử dụng Prisma Migrations để quản lý phiên bản cơ sở dữ liệu. Chạy các lệnh sau để áp dụng migrations lên PostgreSQL và sinh Prisma Client:

```bash
# Áp dụng migrations vào database (Development)
npx prisma migrate dev

# Sinh Prisma Client code vào thư mục generated/prisma
npx prisma generate
```

> 💡 **Ghi chú**: Đối với môi trường Production / CI-CD, sử dụng lệnh `npx prisma migrate deploy` để áp dụng các migrations hiện có mà không tạo file migration mới.


---

### Bước 5: Khởi chạy Server

#### 🔹 Chạy môi trường Phát triển (Development):
```bash
npm run dev
```
Server sẽ chạy tại: `http://localhost:3000` (Hỗ trợ hot-reload với `tsx watch`).

#### 🔹 Build & Chạy Production:
```bash
npm run build
npm start
```

---

### Bước 6: Chạy bộ Kiểm thử tự động (Integration Tests)

Dự án đã tích hợp sẵn bộ kiểm thử tích hợp tự động toàn bộ kịch bản nghiệp vụ (Create, Update, Issue, Conflict Prevention, Replace Transaction, Cancel, Zod Validation, PDF Generation):

```bash
npx tsx tests/test-api.ts
```

---

## 🧠 5. Kiến thức học được & Best Practices

Qua quá trình xây dựng dự án, các kiến thức và kỹ năng thực chiến quan trọng thu được gồm:

### 1. Quản lý trạng thái & Tính toàn vẹn của Dữ liệu tài chính
* **Vòng đời hóa đơn bất biến**: Hóa đơn sau khi `ISSUED` mang giá trị pháp lý nên không được phép cập nhật (`PATCH`) hay xóa (`DELETE`) trực tiếp.
* **Xử lý số học tài chính**: Trong Javascript, phép tính số thực dấu phẩy động dễ gặp lỗi sai số (ví dụ `0.1 + 0.2 = 0.30000000000000004`). Dự án giải quyết triệt để bằng cách dùng `Decimal(15,2)` trong PostgreSQL / Prisma và làm tròn chuẩn tiền tệ `Math.round(... * 100) / 100` khi xử lý logic.

### 2. Xử lý Giao dịch ACID với Prisma `$transaction`
* Khi thực hiện nghiệp vụ **Thay thế hóa đơn (`replaceInvoice`)**, thao tác gồm nhiều bước: kiểm tra tính hợp lệ của hóa đơn cũ $\rightarrow$ chuyển hóa đơn cũ thành `CANCELED` $\rightarrow$ sinh mã mới $\rightarrow$ tạo hóa đơn mới liên kết `replacedInvoiceId`.
* Sử dụng `prisma.$transaction(async (tx) => { ... })` đảm bảo tính nguyên tử (Atomicity): nếu bất kỳ bước nào thất bại, toàn bộ thao tác sẽ rollback, không bao giờ để lại dữ liệu rác hay trạng thái nửa vời.

### 3. Mô hình quan hệ tự tham chiếu (Self-referencing Relationship)
* Ứng dụng quan hệ Self-relation 1 - N trên cùng một bảng `Invoice` (`replacedInvoice` $\leftrightarrow$ `replacementInvoices`) để theo dõi cây phả hệ/lịch sử các lần thay thế hóa đơn, phục vụ tốt cho kiểm toán và đối soát.

### 4. Prisma ORM 7 & Kiến trúc Driver Adapter
* Sử dụng cấu hình Prisma ORM 7 hiện đại nhất với `@prisma/adapter-pg` và `pg.Pool`, giúp kiểm soát connection pool tốt hơn, tương thích hoàn hảo với môi trường Node.js ESM.

### 5. Kiến trúc phân tầng sạch sẽ (Layered Architecture) & SOLID
* **Routing Layer (`routes/`)**: Định nghĩa endpoints và gắn middleware xác thực.
* **Validation Layer (`lib/schemas/`)**: Khai báo schema Zod, tự động parse/validate kiểu dữ liệu của `body`, `query`, `params` trước khi vào controller.
* **Controller Layer (`controllers/`)**: Tiếp nhận request, gọi service tương ứng và trả HTTP response chuẩn RESTful.
* **Service Layer (`services/`)**: Nơi tập trung 100% nghiệp vụ lõi (Business Logic), độc lập với framework HTTP.
* **Error Handling Layer (`lib/errors.ts` & `middlewares/errorHandler.ts`)**: Định nghĩa các lớp lỗi tường minh (`BadRequestError`, `NotFoundError`, `ConflictError`, `ValidationError`), giúp API trả về mã lỗi HTTP (400, 404, 409, 422, 500) và format JSON đồng nhất.

### 6. Tạo và Stream file PDF chuyên nghiệp
* Sử dụng thư viện `PDFKit` để thiết kế hóa đơn dạng lưới (grid table), căn lề, định dạng ngày tháng, hiển thị trạng thái hóa đơn theo màu sắc trực quan và stream trực tiếp ra HTTP Response stream (`doc.pipe(res)`) mà không cần ghi file tạm vào ổ đĩa, giúp tiết kiệm bộ nhớ máy chủ (RAM/Disk).
