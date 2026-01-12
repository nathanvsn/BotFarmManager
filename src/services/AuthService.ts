// ============================================
// Farm Manager Bot - Auth Service
// ============================================

import axios from 'axios';
import { Logger } from '../utils/logger';

const LOGIN_URL = 'https://farm-app.trophyapi.com/login-check.php';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://farm-app.trophyapi.com',
    'Referer': 'https://farm-app.trophyapi.com/index-login.php',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
};

export class AuthService {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('Auth');
    }

    /**
     * Realiza login no sistema e retorna o PHPSESSID
     * @param email Email do usuário
     * @param password Senha do usuário
     * @returns O PHPSESSID da sessão autenticada
     */
    async login(email: string, password: string): Promise<string> {
        this.logger.info('🔐 Fazendo login automático...');

        try {
            // Primeiro, fazer uma requisição para obter um PHPSESSID inicial
            const initialResponse = await axios.get('https://farm-app.trophyapi.com/index-login.php', {
                headers: {
                    'User-Agent': DEFAULT_HEADERS['User-Agent'],
                    'Accept': DEFAULT_HEADERS['Accept'],
                },
                maxRedirects: 0,
                validateStatus: (status) => status < 400,
            });

            // Extrair PHPSESSID inicial do Set-Cookie
            let initialSessionId = this.extractSessionId(initialResponse.headers['set-cookie']);

            if (!initialSessionId) {
                // Se não veio no header, pode já estar em cookie
                this.logger.debugLog('Nenhum PHPSESSID inicial encontrado, continuando sem...');
                initialSessionId = '';
            }

            // Fazer o login com as credenciais
            const formData = new URLSearchParams();
            formData.append('email', email);
            formData.append('password', password);

            const loginResponse = await axios.post(LOGIN_URL, formData, {
                headers: {
                    ...DEFAULT_HEADERS,
                    Cookie: initialSessionId ? `PHPSESSID=${initialSessionId}; device=web` : 'device=web',
                },
                maxRedirects: 0,
                validateStatus: (status) => status < 400 || status === 302,
            });

            // Extrair o PHPSESSID da resposta de login
            const sessionId = this.extractSessionId(loginResponse.headers['set-cookie']);

            if (sessionId) {
                this.logger.info(`✅ Login realizado com sucesso! Session ID: ${sessionId.substring(0, 8)}...`);
                return sessionId;
            }

            // Se não veio novo cookie, usar o inicial (a sessão foi autenticada)
            if (initialSessionId) {
                this.logger.info(`✅ Login realizado com sucesso! Usando sessão inicial: ${initialSessionId.substring(0, 8)}...`);
                return initialSessionId;
            }

            // Verificar se houve erro na resposta
            const responseData = typeof loginResponse.data === 'string' ? loginResponse.data : '';
            if (responseData.includes('error') || responseData.includes('Invalid')) {
                throw new Error('Credenciais inválidas. Verifique email e senha.');
            }

            throw new Error('Não foi possível obter PHPSESSID após login. Verifique as credenciais.');

        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    throw new Error('Credenciais inválidas. Verifique email e senha.');
                }
                throw new Error(`Erro de conexão ao fazer login: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Extrai o PHPSESSID do header Set-Cookie
     */
    private extractSessionId(setCookieHeader: string[] | undefined): string | null {
        if (!setCookieHeader) {
            return null;
        }

        for (const cookie of setCookieHeader) {
            const match = cookie.match(/PHPSESSID=([^;]+)/);
            if (match) {
                return match[1];
            }
        }

        return null;
    }
}
