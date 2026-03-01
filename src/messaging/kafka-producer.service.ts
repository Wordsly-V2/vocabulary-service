import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
    private kafka: Kafka | null = null;
    private producer: Producer | null = null;

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit(): Promise<void> {
        const brokers = this.configService.get<string>('kafka.brokers') ?? '';
        const ca = this.configService.get<string>('kafka.ca') ?? '';
        const cert = this.configService.get<string>('kafka.cert') ?? '';
        const key = this.configService.get<string>('kafka.key') ?? '';
        const brokerList = brokers.split(',').filter(Boolean);
        if (brokerList.length === 0) {
            return;
        }
        this.kafka = new Kafka({
            clientId: 'vocabulary-service-producer',
            brokers: brokerList,
            ssl:
                ca && cert && key
                    ? {
                          rejectUnauthorized: true,
                          ca,
                          cert,
                          key,
                      }
                    : undefined,
        });
        this.producer = this.kafka.producer();
        await this.producer.connect();
    }

    async onModuleDestroy(): Promise<void> {
        if (this.producer) {
            await this.producer.disconnect();
            this.producer = null;
        }
        this.kafka = null;
    }

    /**
     * Sends a single message to the given topic. No-op if Kafka is not configured.
     */
    async send(topic: string, payload: object): Promise<void> {
        if (!this.producer) return;
        await this.producer.send({
            topic,
            messages: [
                {
                    value: JSON.stringify(payload),
                },
            ],
        });
    }

    /**
     * Sends multiple messages to the given topic in one batch. No-op if Kafka is not configured.
     */
    async sendBatch(topic: string, payloads: object[]): Promise<void> {
        if (!this.producer || payloads.length === 0) return;
        await this.producer.send({
            topic,
            messages: payloads.map((payload) => ({
                value: JSON.stringify(payload),
            })),
        });
    }
}
