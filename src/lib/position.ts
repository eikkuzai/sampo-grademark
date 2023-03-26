import { ITimestampedValue } from "./trade";
import { StrategyOptions, TradeDirection } from "./strategy";
import Decimal from "decimal.js";

/**
 * Interface that defines an open position.
 */
export interface IPosition {

    /**
     * The direction of the position.
     * Long or short.
     */
    direction: TradeDirection;

    /***
     * Timestamp when the position was entered.
     */
    entryTime: Date;

    /**
     * Price when the position was entered.
     */
    entryPrice: Decimal;

    /**
     * Reason for entering the position
     */
    entryReason?: string | string[];

    /**
     * Net profit or loss.
     */
    profit: Decimal;

    /**
     * Profit expressed as a percentage.
     */
    profitPct: Decimal;

    /**
     * Optional initial risk in dollars computed from stop loss.
     */
    initialUnitRisk?: Decimal;

    /**
     * Optional initial risk computed from stop loss and expressed as a percentage of entry price.
     */
    initialRiskPct?: Decimal;

    /**
     * Ongoing risk, the difference of current price and stop loss expressed as a percentage of current price.
     */
    curRiskPct?: Decimal;

    /**
     * Optional profit expressed as a multiple of initial unit risk.
     */
    curRMultiple?: Decimal;

    /**
     * Records the risk series, if enabled.
     */
    riskSeries?: ITimestampedValue[];
    
    /**
     * Number of bars the position was held for.
     */
    holdingPeriod: Decimal;

    /**
     * Initial maximum loss before exit is triggered (intrabar).
     */
    initialStopPrice?: Decimal;

    /**
     * Current (possibly trailing) maximum loss before exit is triggered (intrabar).
     */
    curStopPrice?: Decimal;

    /**
     * Records the stop price series, if enabled.
     */
    stopPriceSeries?: ITimestampedValue[];

    /*
     * Profit target where exit is triggered (intrabar).
     */
    profitTarget?: Decimal;

    /**
     * Size of the position
     */
    size: Decimal;

    strategy?: StrategyOptions;
}