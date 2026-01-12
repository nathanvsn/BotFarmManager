// ============================================
// Farm Manager Bot - Silo Service
// ============================================

import { ApiClient } from '../api/client';
import { SiloTabResponse, SiloProduct } from '../types';
import { Logger } from '../utils/logger';

export interface ProductOverThreshold {
    id: number;
    name: string;
    pctFull: number;
    amount: number;
}

export class SiloService {
    private api: ApiClient;
    private logger: Logger;

    constructor(api: ApiClient, logger: Logger) {
        this.api = api;
        this.logger = logger;
    }

    /**
     * Obtém status completo do silo
     */
    async getSiloStatus(): Promise<SiloTabResponse> {
        return this.api.getSiloTab();
    }

    /**
     * Verifica a capacidade total do silo
     */
    async getSiloCapacity(): Promise<{
        capacity: number;
        totalHolding: number;
        pctFull: number;
    }> {
        const silo = await this.getSiloStatus();
        return {
            capacity: silo.cropSilo.siloCapacity,
            totalHolding: silo.cropSilo.totalHolding,
            pctFull: silo.cropSilo.pctFull,
        };
    }

    /**
     * Obtém todos os produtos armazenados no silo
     */
    async getStoredProducts(): Promise<SiloProduct[]> {
        const silo = await this.getSiloStatus();
        return Object.values(silo.cropSilo.holding);
    }

    /**
     * Obtém produtos acima de um limite percentual
     */
    async getProductsAboveThreshold(threshold: number): Promise<ProductOverThreshold[]> {
        const silo = await this.getSiloStatus();
        const overThreshold: ProductOverThreshold[] = [];

        for (const [id, product] of Object.entries(silo.cropSilo.holding)) {
            if (product.pctFull >= threshold) {
                overThreshold.push({
                    id: product.id,
                    name: product.name,
                    pctFull: product.pctFull,
                    amount: product.amount,
                });
            }
        }

        return overThreshold;
    }

    /**
     * Verifica se algum produto está acima do limite
     */
    async hasProductsOverThreshold(threshold: number): Promise<boolean> {
        const products = await this.getProductsAboveThreshold(threshold);
        return products.length > 0;
    }

    /**
     * Obtém um produto específico por ID
     */
    async getProductById(productId: number): Promise<SiloProduct | null> {
        const products = await this.getStoredProducts();
        return products.find(p => p.id === productId) || null;
    }

    /**
     * Loga status do silo
     */
    async logSiloStatus(): Promise<void> {
        const capacity = await this.getSiloCapacity();
        this.logger.silo(
            `Silo: ${capacity.totalHolding.toLocaleString()}kg / ${capacity.capacity.toLocaleString()}kg (${capacity.pctFull.toFixed(2)}%)`
        );

        const products = await this.getStoredProducts();
        for (const product of products) {
            this.logger.silo(
                `  - ${product.name}: ${product.amount.toLocaleString()}kg (${product.pctFull.toFixed(2)}%)`
            );
        }
    }
}
