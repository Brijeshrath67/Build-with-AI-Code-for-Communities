# Security

- JWT-based authentication using HS256
- Passwords hashed with bcrypt
- Rate limiting via Redis (100 requests/minute per IP)
- Role-based access control: System Admin, District Health Official, PHC Staff, ASHA Worker
- Deletion of stock records requires password confirmation
- CORS configured to allow all origins (development only — restrict in production)
