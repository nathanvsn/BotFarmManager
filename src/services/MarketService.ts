// ============================================
// Farm Manager Bot - Market Service
// ============================================

import { ApiClient } from '../api/client';
import { CropValue, CropValuesResponse, SellProductResponse } from '../types';
import { Logger } from '../utils/logger';

export interface SellResult {
    success: boolean;
    productId: number;
    productName: string;
    amountSold: number;
    income: number;
    remaining: number;
}

export class MarketService {
    private api: ApiClient;
    private logger: Logger;
    private cropNames: Map<number, string> = new Map();

    constructor(api: ApiClient, logger: Logger) {
        this.api = api;
        this.logger = logger;
    }

    /**
     * Obtém valores atuais de todos os produtos no mercado
     */
    async getCropValues(): Promise<Record<string, CropValue>> {
        const response = await this.api.getCropValues();
        return response.cropValues;
    }

    /**
     * Obtém o valor de um produto específico
     */
    async getCropValue(cropId: number): Promise<CropValue | null> {
        const values = await this.getCropValues();
        return values[String(cropId)] || null;
    }

    /**
     * Vende todo o estoque de um produto
     */
    async sellProduct(cropId: number, productName?: string): Promise<SellResult> {
        try {
            const response = await this.api.sellProduct(cropId, 'all');

            const result: SellResult = {
                success: response.success === 1,
                productId: cropId,
                productName: response.cropData?.name || productName || `Crop ${cropId}`,
                amountSold: response.amount,
                income: response.income,
                remaining: response.remaining,
            };

            if (result.success) {
                this.logger.market(
                    `Vendido ${result.amountSold.toLocaleString()}kg de ${result.productName} por $${result.income.toLocaleString()}`
                );
            } else {
                this.logger.warn(`Falha ao vender ${result.productName}`);
            }

            return result;
        } catch (error) {
            this.logger.error(`Erro ao vender produto ${cropId}`, error as Error);
            return {
                success: false,
                productId: cropId,
                productName: productName || `Crop ${cropId}`,
                amountSold: 0,
                income: 0,
                remaining: 0,
            };
        }
    }

    /**
     * Vende múltiplos produtos
     */
    async sellMultipleProducts(
        products: Array<{ id: number; name: string }>
    ): Promise<SellResult[]> {
        const results: SellResult[] = [];

        for (const product of products) {
            const result = await this.sellProduct(product.id, product.name);
            results.push(result);

            // Pequeno delay entre vendas para evitar rate limiting
            await this.delay(500);
        }

        return results;
    }

    /**
     * Calcula o valor total que seria obtido vendendo um produto
     */
    async estimateSaleValue(cropId: number, amount: number): Promise<number> {
        const value = await this.getCropValue(cropId);
        if (!value) return 0;

        // cropValuePer1k é o valor por 1000kg
        return (amount / 1000) * value.cropValuePer1k;
    }

    /**
     * Verifica se é um bom momento para vender (preço subindo)
     */
    async isPriceIncreasing(cropId: number): Promise<boolean> {
        const value = await this.getCropValue(cropId);
        return value?.priceIncrease === 1;
    }

    /**
     * Obtém histórico de preços de um produto
     */
    async getPriceHistory(cropId: number): Promise<number[]> {
        const response = await this.api.getCropValues();
        return response.history[String(cropId)] || [];
    }

    /**
     * Resumo de todas as vendas
     */
    summarizeSales(results: SellResult[]): {
        totalSold: number;
        totalIncome: number;
        successCount: number;
        failedCount: number;
    } {
        return results.reduce(
            (acc, result) => ({
                totalSold: acc.totalSold + (result.success ? result.amountSold : 0),
                totalIncome: acc.totalIncome + result.income,
                successCount: acc.successCount + (result.success ? 1 : 0),
                failedCount: acc.failedCount + (result.success ? 0 : 1),
            }),
            { totalSold: 0, totalIncome: 0, successCount: 0, failedCount: 0 }
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
