import { ReactNode, useCallback, lazy, Suspense, useState } from "react";
import { OrderlyAppProvider } from "@orderly.network/react-app";
import { useOrderlyConfig } from "@/utils/config";
import type { NetworkId } from "@orderly.network/types";
import { LocaleProvider, LocaleCode, LocaleEnum, defaultLanguages, Resources } from "@orderly.network/i18n";
import { withBasePath } from "@/utils/base-path";
import { getSEOConfig, getUserLanguage } from "@/utils/seo";
import { getRuntimeConfigBoolean, getRuntimeConfigArray, getRuntimeConfig } from "@/utils/runtime-config";
import { DemoGraduationChecker } from "@/components/DemoGraduationChecker";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import ServiceDisclaimerDialog from "./ServiceRestrictionsDialog";
// import { useIpRestriction } from "@/hooks/useIpRestriction";

const NETWORK_ID_KEY = "orderly_network_id";


const getNetworkId = (): NetworkId => {
	if (typeof window === "undefined") return "mainnet";

	const disableMainnet = getRuntimeConfigBoolean('VITE_DISABLE_MAINNET');
	const disableTestnet = getRuntimeConfigBoolean('VITE_DISABLE_TESTNET');

	if (disableMainnet && !disableTestnet) {
		return "testnet";
	}

	if (disableTestnet && !disableMainnet) {
		return "mainnet";
	}

	return (localStorage.getItem(NETWORK_ID_KEY) as NetworkId) || "mainnet";
};

const setNetworkId = (networkId: NetworkId) => {
	if (typeof window !== "undefined") {
		localStorage.setItem(NETWORK_ID_KEY, networkId);
	}
};

const getAvailableLanguages = (): string[] => {
	const languages = getRuntimeConfigArray('VITE_AVAILABLE_LANGUAGES');

	return languages.length > 0 ? languages : ['en'];
};

const getDefaultLanguage = (): LocaleCode => {
	const seoConfig = getSEOConfig();
	const userLanguage = getUserLanguage();
	const availableLanguages = getAvailableLanguages();

	if (typeof window !== 'undefined') {
		const urlParams = new URLSearchParams(window.location.search);
		const langParam = urlParams.get('lang');
		if (langParam && availableLanguages.includes(langParam)) {
			return langParam as LocaleCode;
		}
	}

	if (seoConfig.language && availableLanguages.includes(seoConfig.language)) {
		return seoConfig.language as LocaleCode;
	}

	if (availableLanguages.includes(userLanguage)) {
		return userLanguage as LocaleCode;
	}

	return (availableLanguages[0] || 'en') as LocaleCode;
};

const PrivyConnector = lazy(() => import("@/components/orderlyProvider/privyConnector"));
const WalletConnector = lazy(() => import("@/components/orderlyProvider/walletConnector"));

const LocaleProviderWithLanguages = lazy(async () => {
	const languageCodes = getAvailableLanguages() || ["en"];
	console.log("Available languages from env:", languageCodes);

	const languagePromises = languageCodes.map(async (code: string) => {
		console.log("Loading language:", code);
		const trimmedCode = code.trim();
		try {
			// Load main language file
			const mainResponse = await fetch(
				`${import.meta.env.VITE_BASE_URL ?? ""}/locales/${trimmedCode}.json?v=44399b2a`
			);
			if (!mainResponse.ok) {
				throw new Error(
					`Failed to fetch ${trimmedCode}.json: ${mainResponse.status}`
				);
			}
			const mainData = await mainResponse.json();

			// Load extended language file
			let extendedData = {};
			try {
				const extendedResponse = await fetch(
					`${import.meta.env.VITE_BASE_URL ?? ""
					}/locales/extend/${trimmedCode}.json?v=44399b2a`
				);
				if (extendedResponse.ok) {
					extendedData = await extendedResponse.json();
				}
			} catch (extendedError) {
				console.warn(
					`Extended language file not found for ${trimmedCode}`,
					extendedError
				);
			}

			// Merge main data with extended data (extended data takes precedence)
			const mergedData = { ...mainData, ...extendedData };

			return { code: trimmedCode, data: mergedData };
		} catch (error) {
			console.error(`Failed to load language: ${trimmedCode}`, error);
			return null;
		}
	});

	const results = await Promise.all(languagePromises);
	console.log("Loaded language resources:", results);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const initialResources: Resources<any> = {};
	results.forEach((result) => {
		if (result) {
			initialResources[result.code] = result.data;
		}
	});
	const resources_save = { ...initialResources };

	// Patch defaultLanguages to replace displayName for zh to Hebrew
	// Adding hebrew to defaultLanguages
	const languagesWithHebrew = defaultLanguages.map(lang =>
		lang.localCode === 'zh' ? { ...lang, displayName: 'עברית' } : lang
	);

	languagesWithHebrew.push({ localCode: 'he', displayName: 'עברית' });
	const languages = languagesWithHebrew.filter((lang) =>
		languageCodes.some((code: string) => code.trim() === lang.localCode)
	);
	console.log("Filtered languages for LocaleProvider:", languages);

	return {
		default: ({ children }: { children: ReactNode }) => {
			const [resources, setResources] = useState<Resources<any>>(initialResources);

			const onLanguageChanged = async (lang: LocaleCode) => {
				document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';

				if (lang === 'he') {
					// Load Hebrew data into en version
					setResources(prev => ({
						...prev,
						en: resources_save.he || resources_save.en
					}));
				} else if (lang === 'en') {
					// Load English data into en version
					setResources(prev => ({
						...prev,
						en: resources_save.en
					}));
				}

				console.log("Language changed to:", lang);
			};

			return (
				<LocaleProvider resources={resources} languages={languages} onLanguageChanged={onLanguageChanged}>
					{children}
				</LocaleProvider>
			);
		},
	};
});


const OrderlyProvider = (props: { children: ReactNode }) => {
	const config = useOrderlyConfig();
	const networkId = getNetworkId();
	// const { isRestricted } = useIpRestriction();

	const privyAppId = getRuntimeConfig('VITE_PRIVY_APP_ID');
	const usePrivy = !!privyAppId;

	const parseChainIds = (envVar: string | undefined): Array<{ id: number }> | undefined => {
		if (!envVar) return undefined;
		return envVar.split(',')
			.map(id => id.trim())
			.filter(id => id)
			.map(id => ({ id: parseInt(id, 10) }))
			.filter(chain => !isNaN(chain.id));
	};

	const parseDefaultChain = (envVar: string | undefined): { mainnet: { id: number } } | undefined => {
		if (!envVar) return undefined;

		const chainId = parseInt(envVar.trim(), 10);
		return !isNaN(chainId) ? { mainnet: { id: chainId } } : undefined;
	};

	const disableMainnet = getRuntimeConfigBoolean('VITE_DISABLE_MAINNET');
	const mainnetChains = disableMainnet ? [] : parseChainIds(getRuntimeConfig('VITE_ORDERLY_MAINNET_CHAINS'));
	const disableTestnet = getRuntimeConfigBoolean('VITE_DISABLE_TESTNET');
	const testnetChains = disableTestnet ? [] : parseChainIds(getRuntimeConfig('VITE_ORDERLY_TESTNET_CHAINS'));

	const chainFilter = (mainnetChains || testnetChains) ? {
		...(mainnetChains && { mainnet: mainnetChains }),
		...(testnetChains && { testnet: testnetChains })
	} : undefined;

	const defaultChain = parseDefaultChain(getRuntimeConfig('VITE_DEFAULT_CHAIN'));

	const onChainChanged = useCallback(
		(_chainId: number, { isTestnet }: { isTestnet: boolean }) => {
			const currentNetworkId = getNetworkId();
			if ((isTestnet && currentNetworkId === 'mainnet') || (!isTestnet && currentNetworkId === 'testnet')) {
				const newNetworkId: NetworkId = isTestnet ? 'testnet' : 'mainnet';
				setNetworkId(newNetworkId);

				setTimeout(() => {
					window.location.reload();
				}, 100);
			}
		},
		[]
	);

	const loadPath = (lang: LocaleCode) => {
		const availableLanguages = getAvailableLanguages();

		if (!availableLanguages.includes(lang)) {
			return [];
		}

		if (lang === LocaleEnum.en) {
			return withBasePath(`/locales/extend/${lang}.json`);
		}
		return [
			withBasePath(`/locales/${lang}.json`),
			withBasePath(`/locales/extend/${lang}.json`)
		];
	};

	const defaultLanguage = getDefaultLanguage();

	const availableLanguages = getAvailableLanguages();
	const filteredLanguages = defaultLanguages.filter(lang =>
		availableLanguages.includes(lang.localCode)
	);

	// if (isRestricted) {
	//   return (
	//     <>
	//       <ServiceDisclaimerDialog isRestricted={isRestricted} />
	//       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#101014', color: '#fff', fontSize: '2rem', fontWeight: 'bold' }}>
	//         Service not available in your region.
	//       </div>
	//     </>
	//   );
	// }

	const appProvider = (
		<OrderlyAppProvider
			brokerId={getRuntimeConfig('VITE_ORDERLY_BROKER_ID')}
			brokerName={getRuntimeConfig('VITE_ORDERLY_BROKER_NAME')}
			networkId={networkId}
			onChainChanged={onChainChanged}
			appIcons={config.orderlyAppProvider.appIcons}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{...(chainFilter && { chainFilter } as any)}
			defaultChain={defaultChain}
		>
			<DemoGraduationChecker />
			<ServiceDisclaimerDialog isRestricted={false} />
			{props.children}
		</OrderlyAppProvider>
	);

	const walletConnector = usePrivy
		? <PrivyConnector networkId={networkId}>{appProvider}</PrivyConnector>
		: <WalletConnector networkId={networkId}>{appProvider}</WalletConnector>;

	return (
		<LocaleProviderWithLanguages>
			<Suspense fallback={<LoadingSpinner />}>
				{walletConnector}
			</Suspense>
		</LocaleProviderWithLanguages>
	);
};

export default OrderlyProvider;
