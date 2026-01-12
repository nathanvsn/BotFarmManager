// ============================================
// Farm Manager Bot - Tractor Service
// ============================================

import { ApiClient } from '../api/client';
import {
    CultivatingTabResponse,
    SeedingTabResponse,
    TractorData,
    FarmTractors,
    AvailableTractor,
    OperationType,
    BatchActionUnit,
} from '../types';
import { Logger } from '../utils/logger';

export class TractorService {
    private api: ApiClient;
    private logger: Logger;

    constructor(api: ApiClient, logger: Logger) {
        this.api = api;
        this.logger = logger;
    }

    /**
     * Obtém todos os tratores disponíveis (não em uso) de todas as farms
     */
    async getAvailableTractors(): Promise<AvailableTractor[]> {
        const response = await this.api.getCultivatingTab();
        return this.extractAvailableTractors(response.tractors);
    }

    /**
     * Obtém tratores disponíveis para um tipo de operação específico
     */
    async getTractorsForOperation(opType: OperationType): Promise<AvailableTractor[]> {
        const allTractors = await this.getAvailableTractors();
        return allTractors.filter(t => t.opType === opType);
    }

    /**
     * Obtém tratores disponíveis em uma farm específica
     */
    async getTractorsInFarm(farmId: number): Promise<AvailableTractor[]> {
        const allTractors = await this.getAvailableTractors();
        return allTractors.filter(t => t.farmId === farmId);
    }

    /**
     * Extrai tratores disponíveis da resposta da API
     */
    private extractAvailableTractors(
        tractors: Record<string, FarmTractors>
    ): AvailableTractor[] {
        const available: AvailableTractor[] = [];

        for (const [farmId, farmTractors] of Object.entries(tractors)) {
            // Verificar tratores de plowing
            if (farmTractors.plowing) {
                for (const [id, tractor] of Object.entries(farmTractors.plowing.data)) {
                    if (tractor.inUse === 0) {
                        available.push({
                            id: tractor.id,
                            farmId: Number(farmId),
                            haHour: tractor.haHour,
                            opType: 'plowing',
                        });
                    }
                }
            }

            // Verificar tratores de clearing
            if (farmTractors.clearing) {
                for (const [id, tractor] of Object.entries(farmTractors.clearing.data)) {
                    if (tractor.inUse === 0) {
                        available.push({
                            id: tractor.id,
                            farmId: Number(farmId),
                            haHour: tractor.haHour,
                            opType: 'clearing',
                        });
                    }
                }
            }

            // Verificar tratores de seeding
            if (farmTractors.seeding) {
                for (const [id, tractor] of Object.entries(farmTractors.seeding.data)) {
                    if (tractor.inUse === 0) {
                        available.push({
                            id: tractor.id,
                            farmId: Number(farmId),
                            haHour: tractor.haHour,
                            opType: 'seeding',
                        });
                    }
                }
            }

            // Verificar tratores de harvesting
            if (farmTractors.harvesting) {
                for (const [id, tractor] of Object.entries(farmTractors.harvesting.data)) {
                    if (tractor.inUse === 0) {
                        available.push({
                            id: tractor.id,
                            farmId: Number(farmId),
                            haHour: tractor.haHour,
                            opType: 'harvesting',
                        });
                    }
                }
            }
        }

        return available;
    }

    /**
     * Busca o melhor trator disponível para uma operação em uma farm
     */
    async getBestTractorForTask(
        farmId: number,
        opType: OperationType
    ): Promise<AvailableTractor | null> {
        const tractors = await this.getTractorsInFarm(farmId);
        const compatibleTractors = tractors.filter(t => t.opType === opType);

        if (compatibleTractors.length === 0) {
            return null;
        }

        // Retorna o trator com maior haHour (mais rápido)
        return compatibleTractors.reduce((best, current) =>
            current.haHour > best.haHour ? current : best
        );
    }

    /**
     * Obtém detalhes de equipamento para uma fazenda para uma operação específica
     */
    async getEquipmentForFarmland(farmlandId: number, desiredOpType?: string): Promise<{
        tractorId: number;
        implementId?: number;
        opType: string;
    } | null> {
        const details = await this.api.getFarmlandDetails(farmlandId);

        // Remover geometry do log (muito grande)
        const { geometry, ...detailsWithoutGeometry } = details as any;
        this.logger.debugLog(`[FarmlandDetails] Response para farmlandId ${farmlandId}: ${JSON.stringify(detailsWithoutGeometry, null, 2)}`);

        // Verificar qual operação está disponível e retornar o equipamento
        const equipment = details.equipment;

        if (!equipment) {
            this.logger.debugLog('[FarmlandDetails] Nenhum equipamento encontrado');
            return null;
        }

        this.logger.debugLog(`[Equipment] plowing.available: ${equipment.plowing?.data?.available}, units: ${JSON.stringify(equipment.plowing?.units)}`);
        this.logger.debugLog(`[Equipment] seeding.available: ${equipment.seeding?.data?.available}, units: ${JSON.stringify(equipment.seeding?.units)}`);
        this.logger.debugLog(`[Equipment] harvesting.available: ${equipment.harvesting?.data?.available}, units: ${JSON.stringify(equipment.harvesting?.units)}`);
        this.logger.debugLog(`[Equipment] clearing.available: ${equipment.clearing?.data?.available}, units: ${JSON.stringify(equipment.clearing?.units)}`);

        // Buscar lista de tratores disponíveis para associar com implementos
        const tractorResponse = await this.api.getCultivatingTab();
        const availableTractors = this.extractAvailableTractors(tractorResponse.tractors || {});
        this.logger.debugLog(`[Tractors] Tratores disponíveis: ${JSON.stringify(availableTractors)}`);

        // Se um opType específico foi solicitado, buscar esse primeiro
        if (desiredOpType) {
            const result = this.getEquipmentForOpType(equipment, desiredOpType, availableTractors, details.farmId);
            if (result) {
                this.logger.debugLog(`[Equipment] Encontrado equipamento para ${desiredOpType}: ${JSON.stringify(result)}`);
                return result;
            }
            this.logger.debugLog(`[Equipment] Nenhum equipamento disponível para ${desiredOpType}`);
        }

        // Fallback: tentar encontrar qualquer equipamento disponível
        // Ordem de prioridade: harvesting -> clearing -> plowing -> seeding
        const opOrder = ['harvesting', 'clearing', 'plowing', 'seeding'];
        for (const opType of opOrder) {
            const result = this.getEquipmentForOpType(equipment, opType, availableTractors, details.farmId);
            if (result) {
                return result;
            }
        }

        return null;
    }

    /**
     * Extrai equipamento para um tipo de operação específico
     */
    private getEquipmentForOpType(
        equipment: any,
        opType: string,
        availableTractors: AvailableTractor[],
        farmId: number
    ): { tractorId: number; implementId?: number; opType: string } | null {
        const opEquipment = equipment[opType];

        if (!opEquipment?.data?.available || opEquipment.data.available === 0) {
            return null;
        }

        const units = opEquipment.units;
        if (!units || units.length === 0) {
            return null;
        }

        const unit = units[0];

        // Para harvesting e clearing, usar id ou heavyId diretamente
        let tractorId = unit.id || unit.heavyId || 0;
        const implementId = unit.implementId;

        // Para seeding e plowing (que usam implementos), o tractorId vem da lista de tratores
        if (tractorId === 0 && implementId) {
            // Buscar trator disponível para este tipo de operação na mesma farm
            const tractor = availableTractors.find(t =>
                t.opType === opType && t.farmId === farmId
            );

            if (tractor) {
                tractorId = tractor.id;
                this.logger.debugLog(`[Equipment] Encontrado trator ${tractorId} para ${opType} via lista de tratores`);
            } else {
                // Tentar qualquer trator do mesmo tipo em qualquer farm
                const anyTractor = availableTractors.find(t => t.opType === opType);
                if (anyTractor) {
                    tractorId = anyTractor.id;
                    this.logger.debugLog(`[Equipment] Usando trator ${tractorId} de outra farm para ${opType}`);
                }
            }
        }

        if (tractorId === 0) {
            this.logger.debugLog(`[Equipment] ${opType} não tem tractorId válido`);
            return null;
        }

        return {
            tractorId,
            implementId,
            opType,
        };
    }

    /**
     * Prepara os dados de unidades para uma ação batch
     */
    buildBatchUnits(tractorId: number, implementId?: number): Record<string, BatchActionUnit> {
        const unit: BatchActionUnit = { tractorId };
        if (implementId) {
            unit.implementId = implementId;
        }
        return { [String(tractorId)]: unit };
    }
}
