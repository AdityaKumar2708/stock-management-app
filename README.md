# Stock Management + Billing App (Spring Boot + Gradle)

A full-stack web app with:
- Email/password authentication (JWT)
- Stock/Inventory management
- Customer management
- Billing (invoice creation)
- Vibrant left-side navbar UI

## Tech Stack
- Backend: Spring Boot 3, Spring Security, Spring Data JPA, PostgreSQL
- Build: Gradle
- Frontend: Vanilla HTML/CSS/JS served from Spring static resources

## Project Structure
- `src/main/java/com/stockapp/...` -> backend code
- `src/main/resources/static/...` -> frontend files

## Run
1. Create PostgreSQL database:
   - `stock_management`
2. Set environment variables if needed:
   - `DB_URL` (default: `jdbc:postgresql://localhost:5432/stock_management`)
   - `DB_USERNAME` (default: `postgres`)
   - `DB_PASSWORD` (default: `postgres`)
3. Start:
   - `./gradlew bootRun`

App URL:
- `http://localhost:8080`

## Auth APIs
- `POST /api/auth/register`
- `POST /api/auth/login`

After login/register, frontend stores JWT in localStorage and sends `Authorization: Bearer <token>` for protected APIs.
