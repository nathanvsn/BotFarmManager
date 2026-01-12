// ============================================
// Farm Manager Bot - Farm Service
// ============================================

import { ApiClient } from '../api/client';
import {
    CultivatingTabResponse,
    SeedingTabResponse,
    HarvestTabResponse,
    FarmlandData,
    AvailableTask,
    FarmlandState,
    Farm,
} from '../types';
import { Logger } from '../utils/logger';

export class FarmService {
    private api: ApiClient;
    private logger: Logger;

    constructor(api: ApiClient, logger: Logger) {
        this.api = api;
        this.logger = logger;
    }

    /**
     * Obtém todas as tarefas disponíveis para cultivo (arar, limpar)
     */
    async getCultivatingTasks(): Promise<AvailableTask[]> {
        const response = await this.api.getCultivatingTab();
        this.logger.debugLog(`[Cultivating] Response: ${JSON.stringify(response, null, 2)}`);

        if (!response.farms) {
            this.logger.debugLog('[Cultivating] Nenhuma farm encontrada na resposta');
            return [];
        }
        return this.extractTasksFromFarms(response.farms, 'cultivating');
    }

    /**
     * Obtém todas as tarefas disponíveis para semeadura
     */
    async getSeedingTasks(): Promise<AvailableTask[]> {
        const response = await this.api.getSeedingTab();
        this.logger.debugLog(`[Seeding] Response: ${JSON.stringify(response, null, 2)}`);

        if (!response.farms) {
            this.logger.debugLog('[Seeding] Nenhuma farm encontrada na resposta');
            return [];
        }
        return this.extractTasksFromFarms(response.farms, 'seeding');
    }

    /**
     * Obtém todas as tarefas disponíveis para colheita
     * A estrutura da resposta de Harvest é diferente das outras abas!
     */
    async getHarvestingTasks(): Promise<AvailableTask[]> {
        const response = await this.api.getHarvestTab();
        this.logger.debugLog(`[Harvest] Response: ${JSON.stringify(response, null, 2)}`);

        if (!response.farms) {
            this.logger.debugLog('[Harvest] Nenhuma farm encontrada na resposta');
            return [];
        }

        return this.extractHarvestTasks(response.farms);
    }

    /**
     * Extrai tarefas de colheita da resposta da API
     * Estrutura: farms[farmId].farmlands[cropTypeId].data[farmlandId]
     */
    private extractHarvestTasks(farms: Record<string, any>): AvailableTask[] {
        const tasks: AvailableTask[] = [];

        for (const [farmId, farm] of Object.entries(farms)) {
            const farmlands = (farm as any).farmlands;

            if (!farmlands) continue;

            // farmlands é agrupado por tipo de cultura (1, 2, etc), não por estado
            for (const [cropTypeId, cropFarmlands] of Object.entries(farmlands)) {
                const cropData = cropFarmlands as any;

                if (!cropData.data || cropData.canHarvest !== 1) {
                    continue;
                }

                for (const [farmlandId, farmland] of Object.entries(cropData.data)) {
                    const fl = farmland as any;

                    if (fl.canHarvest === 1) {
                        this.logger.debugLog(`[Harvest] Encontrada colheita: ${fl.farmlandName} (${fl.area}ha)`);
                        tasks.push({
                            type: 'harvesting',
                            farmId: Number(farmId),
                            farmlandId: fl.farmlandId,
                            userFarmlandId: fl.id,
                            area: fl.area,
                            complexityIndex: fl.complexityIndex || 1,
                            farmlandName: fl.farmlandName,
                        });
                    }
                }
            }
        }

        return tasks;
    }

    /**
     * Extrai tarefas disponíveis de uma resposta de farms (cultivating/seeding)
     */
    private extractTasksFromFarms(
        farms: Record<string, Farm>,
        taskType: 'cultivating' | 'seeding'
    ): AvailableTask[] {
        const tasks: AvailableTask[] = [];

        for (const [farmId, farm] of Object.entries(farms)) {
            const farmlands = farm.farmlands;

            if (taskType === 'cultivating') {
                // Para cultivar: verificar terrenos "cleared" (precisam de arar/plowing)
                if (farmlands.cleared) {
                    for (const [id, farmland] of Object.entries(farmlands.cleared.data)) {
                        if (farmlands.cleared.canCultivate > 0) {
                            tasks.push({
                                type: 'plowing',
                                farmId: Number(farmId),
                                farmlandId: farmland.farmlandId,
                                userFarmlandId: farmland.id,
                                area: farmland.area,
                                complexityIndex: farmland.complexityIndex,
                                farmlandName: farmland.farmlandName,
                            });
                        }
                    }
                }
                // Também verificar terrenos "raw" que precisam de clearing
                if (farmlands.raw) {
                    for (const [id, farmland] of Object.entries((farmlands as any).raw.data)) {
                        const fl = farmland as FarmlandData;
                        if ((farmlands as any).raw.canCultivate > 0) {
                            tasks.push({
                                type: 'clearing',
                                farmId: Number(farmId),
                                farmlandId: fl.farmlandId,
                                userFarmlandId: fl.id,
                                area: fl.area,
                                complexityIndex: fl.complexityIndex,
                                farmlandName: fl.farmlandName,
                            });
                        }
                    }
                }
            } else if (taskType === 'seeding') {
                // Para semear: verificar terrenos "plowed" (prontos para semeadura)
                if (farmlands.plowed) {
                    for (const [id, farmland] of Object.entries(farmlands.plowed.data)) {
                        if (farmlands.plowed.canCultivate > 0) {
                            tasks.push({
                                type: 'seeding',
                                farmId: Number(farmId),
                                farmlandId: farmland.farmlandId,
                                userFarmlandId: farmland.id,
                                area: farmland.area,
                                complexityIndex: farmland.complexityIndex,
                                farmlandName: farmland.farmlandName,
                            });
                        }
                    }
                }
            }
        }

        return tasks;
    }

    /**
     * Obtém contadores de tarefas pendentes
     */
    async getTaskCounts(): Promise<{
        pending: number;
        cultivate: number;
        harvesting: number;
        seed: number;
        silo: number;
    }> {
        const response = await this.api.getCultivatingTab();
        return response.count;
    }

    /**
     * Obtém detalhes de uma fazenda específica
     */
    async getFarmlandDetails(farmlandId: number) {
        return this.api.getFarmlandDetails(farmlandId);
    }
}
