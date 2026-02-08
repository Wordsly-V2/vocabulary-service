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

## Kafka / Messaging

- **Event names**: Define event/topic names in one place (e.g. `src/messaging/constants.ts` or per-feature) so producers and consumers stay in sync.
- **Consumers per feature**: Prefer one consumer per feature (e.g. `word-progress.consumer.ts` in the word-progress module) that handles `@EventPattern` and delegates to the feature service. Keep HTTP in the controller, Kafka in the consumer.
- **Thin consumers**: Consumers only parse payload, validate (or use DTOs), and call the feature service; no business logic in the consumer.
- **Config**: Keep Kafka client config in `main.ts` or a small `KafkaModule`; use `ConfigModule` for brokers and SSL.

## Refactoring

When refactoring:

- Reduce duplication.
- Improve readability.
- Maintain backward compatibility.
