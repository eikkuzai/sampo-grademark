import Decimal from "decimal.js";
import { StrategyOptions, TradeDirection } from "./strategy";

/**
 * Represents a value at a particular time.
 */
export interface ITimestampedValue {
    /**
     * Timestamp of the value.
     */
    time: Date;

    /**
     * The value at the time.
     */
    value: Decimal;
}

/**
 * Interface that defines a trade.
 */
export interface ITrade {

    /**
     * The direction of the trade.
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
     * Reason for entering position
     */
    entryReason?: string | string[]

    /**
     * Timestamp when the position was exited.
     */
    exitTime: Date;

    /**
     * Price when the position was exited.
     */
    exitPrice: Decimal;

    /**
     * Net profit or loss.
     */
    profit: Decimal;

    /**
     * Profit expressed as a percentage.
     */
    profitPct: Decimal;

    /**
     * Optional risk computed from stop loss.
     */
    riskPct?: Decimal;

    /**
     * Optional profit expressed as a mutiple of initial risk.
     */
    rmultiple?: Decimal;

    /**
     * The series of risk% recorded over the holding period of the trade (if recording of this is enabled).
     */
    riskSeries?: ITimestampedValue[];
    
    /**
     * Number of bars the position was held for.
     */
    holdingPeriod: Decimal;

    /**
     * The reason the position was exited.
     */
    exitReason: string | string[] | undefined;

    /**
     * Price where stop loss exit is triggered.
     */
    stopPrice?: Decimal;

    /**
     * The series of stop prices recorded over the holding period of the trade (if recording of this is enabled).
     */
    stopPriceSeries?: ITimestampedValue[];

    /**
     * Price where profit target exit is triggered.
     */
    profitTarget?: Decimal;
    size?: Decimal;
    leverage?: Decimal;
    strategy?: string;
}