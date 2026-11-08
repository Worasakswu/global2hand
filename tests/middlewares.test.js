const authMiddleware = require('../middlewares/authMiddleware');
const variablesMiddleware = require('../middlewares/variables');

describe('Middleware Unit Tests (UT-17 to UT-22)', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {
            isAuthenticated: jest.fn(),
            session: {},
            user: null
        };
        mockRes = {
            redirect: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
            locals: {}
        };
        mockNext = jest.fn();
    });

    describe('authMiddleware - ensureAuth', () => {
        // -----------------------------------------------------------------
        // TC-18: calls next if authenticated
        // ขั้นตอน: ตรวจสอบสถานะการล็อกอินที่สำเร็จ
        // Expected: Middleware อนุญาตให้เข้าถึง Route ต่อไป
        // -----------------------------------------------------------------
        test('UT-17: calls next if authenticated', () => {
            mockReq.isAuthenticated.mockReturnValue(true);
            authMiddleware.ensureAuth(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });

        // -----------------------------------------------------------------
        // TC-19: redirects to login if NOT authenticated
        // ขั้นตอน: เข้าถึงหน้าที่ต้องล็อกอินโดยที่ไม่ได้ Authenticate
        // Expected: ระบบส่งตัวผู้ใช้งานไปยังหน้า Login
        // -----------------------------------------------------------------
        test('UT-18: redirects to login if NOT authenticated', () => {
            mockReq.isAuthenticated.mockReturnValue(false);
            authMiddleware.ensureAuth(mockReq, mockRes, mockNext);
            expect(mockRes.redirect).toHaveBeenCalledWith('/auth/login');
        });
    });

    describe('authMiddleware - ensureAdmin', () => {
        // -----------------------------------------------------------------
        // TC-20: calls next if session has isAdmin
        // ขั้นตอน: ตรวจสอบสิทธิ์แอดมิน (session.isAdmin = true)
        // Expected: ระบบอนุญาตให้เข้าหน้าแผงควบคุมหลังบ้าน
        // -----------------------------------------------------------------
        test('UT-19: calls next if session has isAdmin', () => {
            mockReq.session.isAdmin = true;
            authMiddleware.ensureAdmin(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });

        // -----------------------------------------------------------------
        // TC-21: returns 403 if NOT admin
        // ขั้นตอน: เข้าหน้าเจ้าหน้าที่ด้วยบัญชีผู้ใช้ธรรมดา
        // Expected: ระบบคืนค่า HTTP Status 403 และแจ้ง Access Denied
        // -----------------------------------------------------------------
        test('UT-20: returns 403 if NOT admin', () => {
            mockReq.session.isAdmin = false;
            authMiddleware.ensureAdmin(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Access Denied'));
        });
    });

    describe('variablesMiddleware', () => {
        // -----------------------------------------------------------------
        // TC-22: sets res.locals from session and user
        // ขั้นตอน: ตั้งค่าข้อมูลผู้ใช้และสิทธิ์ในตัวแปรส่วนกลาง
        // Expected: ข้อมูลถูกส่งไปยัง res.locals เพื่อใช้ใน EJS Template ทุกหน้า
        // -----------------------------------------------------------------
        test('UT-21: sets res.locals from session and user', () => {
            mockReq.user = { name: 'Test User' };
            mockReq.session.isAdmin = true;
            variablesMiddleware(mockReq, mockRes, mockNext);
            expect(mockRes.locals.user).toEqual(mockReq.user);
            expect(mockRes.locals.isAdmin).toBe(true);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('uploadMiddleware', () => {
        // -----------------------------------------------------------------
        // TC-30: uploadMiddleware exports a valid middleware function
        // ขั้นตอน: โหลดไฟล์ middleware สำหรับอัปโหลด
        // Expected: ต้องได้ฟังก์ชันสำหรับรองรับการส่งไฟล์ Multer
        // -----------------------------------------------------------------
        test('UT-22: uploadMiddleware exports a valid middleware function', () => {
            const upload = require('../middlewares/uploadMiddleware');
            expect(upload).toBeDefined();
            expect(typeof upload).toBe('function');
        });
    });
});
