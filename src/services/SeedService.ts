// ============================================
// Farm Manager Bot - Seed Service
// ============================================

import { ApiClient } from '../api/client';
import { CropScore, MarketSeed, SeedInventory } from '../types';
import { Logger } from '../utils/logger';

export interface BestSeedResult {
    cropId: number;
    cropName: string;
    score: number;
    kgPerHa: number;
    seedCost: number;
    requiredAmount: number;
    currentStock: number;
    needToBuy: number;
}

export class SeedService {
    private api: ApiClient;
    private logger: Logger;

    constructor(api: ApiClient, logger: Logger) {
        this.api = api;
        this.logger = logger;
    }

    /**
     * Determina a melhor semente para uma fazenda baseado em:
     * 1. cropScores da terra
     * 2. Sementes desbloqueadas no mercado
     * 3. Capacidade de comprar
     */
    async getBestSeedForFarmland(farmlandId: number, area: number): Promise<BestSeedResult | null> {
        this.logger.debugLog(`[SeedService] Buscando melhor semente para farmlandId: ${farmlandId}, área: ${area}ha`);

        // 1. Buscar cropScores da terra
        const farmlandData = await this.api.getFarmlandData(farmlandId);

        if (!farmlandData.cropScores) {
            this.logger.warn('[SeedService] Não foi possível obter cropScores da terra');
            return null;
        }

        const cropScores = farmlandData.cropScores as Record<string, CropScore>;
        this.logger.debugLog(`[SeedService] Encontrados ${Object.keys(cropScores).length} cropScores`);

        // 2. Buscar sementes disponíveis no mercado
        const marketData = await this.api.getMarketSeeds();

        if (!marketData.seed || !Array.isArray(marketData.seed)) {
            this.logger.warn('[SeedService] Não foi possível obter sementes do mercado');
            return null;
        }

        const marketSeeds = marketData.seed as MarketSeed[];

        // Criar mapa de sementes desbloqueadas por ID
        const unlockedSeeds = new Map<number, MarketSeed>();
        for (const seed of marketSeeds) {
            if (seed.unlocked === 1 && seed.canAfford === 1) {
                unlockedSeeds.set(seed.id, seed);
            }
        }
        this.logger.debugLog(`[SeedService] ${unlockedSeeds.size} sementes desbloqueadas e disponíveis`);

        // 3. Ordenar cropScores por score (maior primeiro)
        const sortedScores = Object.entries(cropScores)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.score - a.score);

        // 4. Encontrar a melhor semente disponível
        for (const crop of sortedScores) {
            const marketSeed = unlockedSeeds.get(crop.id);

            if (marketSeed) {
                // Calcular quantidade necessária
                const requiredAmount = Math.ceil(area * marketSeed.kgPerHa);

                // Verificar estoque atual
                const currentStock = await this.getSeedStock(crop.id);
                const needToBuy = Math.max(0, requiredAmount - currentStock);

                this.logger.info(
                    `🌱 Melhor semente: ${crop.name} (Score: ${crop.score}) - ` +
                    `Precisa: ${requiredAmount}kg, Estoque: ${currentStock}kg, Comprar: ${needToBuy}kg`
                );

                return {
                    cropId: crop.id,
                    cropName: crop.name,
                    score: crop.score,
                    kgPerHa: marketSeed.kgPerHa,
                    seedCost: marketSeed.seedCost,
                    requiredAmount,
                    currentStock,
                    needToBuy,
                };
            }
        }

        this.logger.warn('[SeedService] Nenhuma semente adequada encontrada');
        return null;
    }

    /**
     * Verifica o estoque atual de uma semente
     */
    async getSeedStock(cropId: number): Promise<number> {
        try {
            const response = await this.api.getSeedingTab();

            if (response.seed && response.seed[String(cropId)]) {
                return response.seed[String(cropId)].amount || 0;
            }

            return 0;
        } catch (error) {
            this.logger.debugLog(`[SeedService] Erro ao verificar estoque do cropId ${cropId}`);
            return 0;
        }
    }

    /**
     * Compra sementes se necessário
     */
    async ensureSeedAvailable(cropId: number, requiredAmount: number): Promise<boolean> {
        const currentStock = await this.getSeedStock(cropId);
        const needToBuy = Math.max(0, requiredAmount - currentStock);

        if (needToBuy === 0) {
            this.logger.debugLog(`[SeedService] Estoque suficiente (${currentStock}kg)`);
            return true;
        }

        this.logger.info(`💰 Comprando ${needToBuy}kg de sementes (cropId: ${cropId})...`);

        try {
            const result = await this.api.buySeeds(cropId, needToBuy);

            if (result.success === 1) {
                this.logger.success(`✅ Compra realizada: ${result.amount}kg por $${result.cost}`);
                return true;
            } else {
                this.logger.warn(`[SeedService] Falha na compra de sementes`);
                return false;
            }
        } catch (error) {
            this.logger.error('[SeedService] Erro ao comprar sementes', error as Error);
            return false;
        }
    }

    /**
     * Fluxo completo: encontra melhor semente e garante disponibilidade
     */
    async prepareForSeeding(farmlandId: number, area: number): Promise<BestSeedResult | null> {
        // 1. Encontrar melhor semente
        const bestSeed = await this.getBestSeedForFarmland(farmlandId, area);

        if (!bestSeed) {
            return null;
        }

        // 2. Garantir que temos sementes suficientes
        if (bestSeed.needToBuy > 0) {
            const purchased = await this.ensureSeedAvailable(bestSeed.cropId, bestSeed.requiredAmount);

            if (!purchased) {
                this.logger.warn('[SeedService] Não foi possível comprar sementes necessárias');
                return null;
            }
        }

        return bestSeed;
    }
}
