You are working on a NestJS backend project.

Always follow these principles:

## Architecture

- Use modular architecture (feature-based modules).
- Each domain must have its own module:
  controller, service, dto, entity, repository.
- Avoid cross-module coupling; use exported providers.

## Reusability

- Extract reusable logic into:
  - shared/
  - common/
  - core/
- Never duplicate business logic.
- Prefer composition over inheritance.

## DTO & Validation

- Always use DTOs with class-validator.
- Never expose raw database models.

## Service Layer

- Controllers must remain thin.
- Business logic belongs only in services.

## Database

- Use repository/service abstraction (PrismaService wrapper).
- Never call Prisma directly inside controllers.

## Error Handling

- Use global exception filters.
- Avoid try/catch unless necessary.

## Naming

- kebab-case folders
- *.service.ts, *.controller.ts, *.module.ts

## Code Quality

- Prefer async/await.
- Avoid any types.
- Use strict typing.

## Refactoring

When refactoring:

- Reduce duplication.
- Improve readability.
- Maintain backward compatibility.
