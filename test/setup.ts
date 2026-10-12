import "dotenv/config";

process.env.RESEND_API_KEY ??= "re_test_dummy_key";
process.env.EMAIL_FROM ??= "SmartBarber <noreply@smartbarber.dev>";
process.env.APP_URL ??= "http://localhost:3333";
process.env.JWT_SECRET ??= "smartbarber-test-secret-key-12345";
process.env.DATABASE_URL ??=
  "postgresql://docker:docker@localhost:5433/smartbarber";
process.env.NODE_ENV ??= "test";
