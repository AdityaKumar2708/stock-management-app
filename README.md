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
   - `SPRING_DATASOURCE_URL` (default: `jdbc:postgresql://localhost:5432/stock_management_db`)
   - `SPRING_DATASOURCE_USERNAME` (default: `postgres`)
   - `SPRING_DATASOURCE_PASSWORD` (default: `postgres`)
   - `APP_JWT_SECRET` (recommended for production)
3. Start:
   - `./gradlew bootRun`

App URL:
- `http://localhost:8080`

## Auth APIs
- `POST /api/auth/register`
- `POST /api/auth/login`

After login/register, frontend stores JWT in localStorage and sends `Authorization: Bearer <token>` for protected APIs.

## Deploy on Render
1. Push the repo with [`render.yaml`](/Users/adityakumar/Stock%20Management%20App/render.yaml) in the root.
2. Create a new Render Blueprint from the repo.
3. Render will create the web service and PostgreSQL database defined in the blueprint.
4. Set `APP_JWT_SECRET` when Render prompts for the secret value.
5. Deploy and use the generated `onrender.com` URL.
