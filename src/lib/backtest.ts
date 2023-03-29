import { ITrade } from "./trade";
import { IDataFrame, DataFrame } from 'data-forge';
import { IStrategy, IBar, IPosition } from "..";
import { assert } from "chai";
import { IEnterPositionOptions, OrderSizeType, StrategyOptions, TradeDirection } from "./strategy";
import { getLongRealisedPnl, getLongRoe, getShortRealisedPnl, getShortRoe, isObject } from "./utils";
const CBuffer = require('CBuffer');
import Decimal from 'decimal.js';

export function asDecimal(n: number | string | Decimal): Decimal {
    return new Decimal(n);
}

/**
 * Update an open position for a new bar.
 * 
 * @param position The position to update.
 * @param bar The current bar.
 */

function updatePosition(position: IPosition, bar: IBar): void {
    
    const closePrice = asDecimal(bar.close);
    position.profit = closePrice.minus(position.entryPrice);
    position.profitPct = (position.profit.dividedBy(position.entryPrice)).times(100);

    // Calculate profit differently if leverage was used
    if (position.size !== undefined && position.strategy && position.strategy.leverage !== undefined) {
        position.profit = position.direction === TradeDirection.Long ?
        getLongRealisedPnl(closePrice, position.entryPrice, position.size, position.strategy.contractMultiplier) :
        getShortRealisedPnl(closePrice, position.entryPrice, position.size, position.strategy.contractMultiplier)

        position.profitPct = position.direction === TradeDirection.Long
        ? getLongRoe(closePrice, position.entryPrice, position.strategy.leverage)
        : getShortRoe(closePrice, position.entryPrice, position.strategy.leverage)
    }

    if (position.curStopPrice !== undefined) {
        const unitRisk = position.direction === TradeDirection.Long
            ? closePrice.minus(position.curStopPrice)
            : position.curStopPrice.minus(closePrice);
        position.curRiskPct = (unitRisk.div(closePrice)).times(100);
        position.curRMultiple = position.profit.div(unitRisk);
    }

    position.holdingPeriod = position.holdingPeriod.plus(1)
}

/**
 * Close a position that has been exited and produce a trade.
 * 
 * @param position The position to close.
 * @param exitTime The timestamp for the bar when the position was exited.
 * @param exitPrice The price of the instrument when the position was exited.
 */
function finalizePosition(position: IPosition, exitTime: Date, exitPrice: Decimal, exitReason: string, fees?: Decimal): ITrade {
    
    let profit = position.direction === TradeDirection.Long 
        ? exitPrice.minus(position.entryPrice)
        : position.entryPrice.minus(exitPrice)
    let rmultiple;
    if (position.initialUnitRisk !== undefined) {
        rmultiple = profit.div(position.initialUnitRisk);
    }

    let profitPct = profit.div(position.entryPrice).times(100);

    console.log("profit without size", profit);
    console.log("profit pct without size", profitPct);

    // Calculate profit differently if leverage was used
    if (position.size !== undefined && position.strategy && position.strategy.leverage !== undefined) {
        profit = position.direction === TradeDirection.Long ?
        getLongRealisedPnl(exitPrice, position.entryPrice, position.size, position.strategy.contractMultiplier) :
        getShortRealisedPnl(exitPrice, position.entryPrice, position.size, position.strategy.contractMultiplier)
        console.log("profit with size:" + profit)

        profitPct = position.direction === TradeDirection.Long
        ? getLongRoe(exitPrice, position.entryPrice, position.strategy.leverage)
        : getShortRoe(exitPrice, position.entryPrice, position.strategy.leverage)

        console.log("profit pct with size:" + profitPct)
    }

    if (fees) {
        // Simulate fees (only using entry price because i cba.. realistically the fee would differ on entry and exit)
        // Order size - 0.08%
        const orderSize = position.size

        // Entry and exit order both take fees so thats why times 2 -.-
        const fee = orderSize.times(fees).dividedBy(100).times(2)
        profit = profit.minus(fee)   
        console.log("profit after fees:" + profit)
    }

    return {
        direction: position.direction,
        entryTime: new Date(position.entryTime),
        entryPrice: position.entryPrice,
        entryReason: position.entryReason,
        exitTime: new Date(exitTime),
        exitPrice: exitPrice,
        profit: profit,
        profitPct: profitPct,
        riskPct: position.initialRiskPct,
        riskSeries: position.riskSeries,
        rmultiple: rmultiple,
        holdingPeriod: position.holdingPeriod,
        exitReason: exitReason,
        stopPrice: position.initialStopPrice,
        stopPriceSeries: position.stopPriceSeries,
        profitTarget: position.profitTarget,
        leverage: position.strategy ? position.strategy.leverage : asDecimal(1),
        size: position.size,
        strategy: JSON.stringify(position.strategy)
    };
}

enum PositionStatus { // Tracks the state of the position across the trading period.
    None,
    Enter,
    Position,
    Exit,
}

/**
 * Options to the backtest function.
 */
export interface IBacktestOptions {
    /**
     * Enable recording of the stop price over the holding period of each trade.
     * It can be useful to enable this and visualize the stop loss over time.
     */
    recordStopPrice?: boolean;

    /**
     * Enable recording of the risk over the holding period of each trade.
     * It can be useful to enable this and visualize the risk over time.
     */
    recordRisk?: boolean;
    strategyOptions: StrategyOptions;
}

/**
 * Backtest a trading strategy against a data series and generate a sequence of trades.
 */
export function backtest<InputBarT extends IBar, IndicatorBarT extends InputBarT, ParametersT, IndexT>(
    strategy: IStrategy<InputBarT, IndicatorBarT, ParametersT, IndexT>, 
    inputSeries: IDataFrame<IndexT, InputBarT>,
    options?: IBacktestOptions): 
    ITrade[] {

    if (!isObject(strategy)) {
        throw new Error("Expected 'strategy' argument to 'backtest' to be an object that defines the trading strategy to backtest.");
    }

    if (!isObject(inputSeries) && inputSeries.count() > 0) {
        throw new Error("Expected 'inputSeries' argument to 'backtest' to be a Data-Forge DataFrame that contains historical input data for backtesting.");
    }

    if (!options || !options.strategyOptions) {
        throw new Error("Expected 'options' argument to 'backtest' to be an object that defines the backtest options.");
    }

    const strategyOptions = options.strategyOptions;
    const initialCapital = strategyOptions.initialCapital;

    // copy initial capital into workingCapital as decimal as we dont want to modify the original
    let workingCapital = asDecimal(initialCapital);

    if (!strategy.orderSize) {
        console.warn("Backtest strategy has no order size fn specified.");
    }

    const orderSizeType: OrderSizeType = strategy.orderSize ? strategy.orderSize() : { type: "percentageOfEquity", percentage: asDecimal(90) };

    if (inputSeries.none()) {
        throw new Error("Expect input data series to contain at last 1 bar.");
    }

    const lookbackPeriod = strategy.lookbackPeriod || 1;
    if (inputSeries.count() < lookbackPeriod) {
        throw new Error("You have less input data than your lookback period, the size of your input data should be some multiple of your lookback period.");
    }

    const strategyParameters = strategy.parameters || {} as ParametersT;

    let indicatorsSeries: IDataFrame<IndexT, IndicatorBarT>;

    //
    // Prepare indicators.
    //
    if (strategy.prepIndicators) {
        indicatorsSeries = strategy.prepIndicators({
            parameters: strategyParameters, 
            inputSeries: inputSeries
        });
    }
    else {
        indicatorsSeries = inputSeries as IDataFrame<IndexT, IndicatorBarT>;
    }

    //
    // Sum of maker fee and taker fee.
    //
    const fees = strategy.fees ? strategy.fees() : undefined;
    if (!fees) {
        console.warn("Fee fn not found on strategy, fees will be undefined");
    }

    //
    // Tracks trades that have been closed.
    //
    const completedTrades: ITrade[] = [];
    
    //
    // Status of the position at any give time.
    //
    let positionStatus: PositionStatus = PositionStatus.None;

    //
    // Records the direction of a position/trade.
    //
    let positionDirection: TradeDirection = TradeDirection.Long;

    //
    // Records the price for conditional intrabar entry.
    //
    let conditionalEntryPrice: Decimal | undefined;

    // Reason for entering
    let entryReason: string[] | string | undefined;

    //
    // Tracks the currently open position, or set to null when there is no open position.
    //
    let openPosition: IPosition | null = null;

    //
    // Create a circular buffer to use for the lookback.
    //
    const lookbackBuffer = new CBuffer(lookbackPeriod);

    /**
     * User calls this function to enter a position on the instrument.
     */
    function enterPosition(options?: IEnterPositionOptions) {
        assert(positionStatus === PositionStatus.None, "Can only enter a position when not already in one.");

        positionStatus = PositionStatus.Enter; // Enter position next bar.
        positionDirection = options && options.direction || TradeDirection.Long;
        conditionalEntryPrice = options && options.entryPrice;
        entryReason = options && options.entryReason
    }

    /**
     * User calls this function to exit a position on the instrument.
     */
    function exitPosition() {
        assert(positionStatus === PositionStatus.Position, "Can only exit a position when we are in a position.");

        positionStatus = PositionStatus.Exit; // Exit position next bar.
    }

    //
    // Close the current open position.
    //
    function closePosition(bar: InputBarT, exitPrice: Decimal, exitReason: string) {
        const trade = finalizePosition(openPosition!, bar.time, exitPrice, exitReason, fees);
        completedTrades.push(trade!);

        workingCapital = workingCapital.plus(trade!.profit);
        console.log(trade.profit);
        console.log("updated working capital:", workingCapital);
        
        // Reset to no open position;
        openPosition = null;
        positionStatus = PositionStatus.None;
    }

    for (const bar of indicatorsSeries) {
        lookbackBuffer.push(bar);

        if (lookbackBuffer.length < lookbackPeriod) {
            continue; // Don't invoke rules until lookback period is satisfied.
        }

        switch (+positionStatus) { //TODO: + is a work around for TS switch stmt with enum.
            case PositionStatus.None:
                strategy.entryRule(enterPosition, {
                    bar: bar, 
                    lookback: new DataFrame<number, IndicatorBarT>(lookbackBuffer.data), 
                    parameters: strategyParameters
                });
                break;

            case PositionStatus.Enter:
                assert(openPosition === null, "Expected there to be no open position initialised yet!");

                if (conditionalEntryPrice !== undefined) {
                    // Must breach conditional entry price before entering position.
                    if (positionDirection === TradeDirection.Long) {
                        if (asDecimal(bar.high).lt(conditionalEntryPrice)) {
                            break;
                        }
                    }
                    else {
                        if (asDecimal(bar.low).gt(conditionalEntryPrice)) {
                            break;
                        }
                    }
                }

                const entryPrice = bar.open;

                openPosition = {
                    direction: positionDirection,
                    entryTime: bar.time,
                    entryPrice: asDecimal(entryPrice),
                    entryReason: entryReason,
                    profit: asDecimal(0),
                    profitPct: asDecimal(0),
                    holdingPeriod: asDecimal(0),
                    size: asDecimal(0),
                    strategy: strategyOptions
                };

                console.log("fees used: " + fees)

                if (orderSizeType.type === "percentageOfEquity") {

                    const usableUsdt = workingCapital.times(orderSizeType.percentage.dividedBy(100));
                    const leverage = strategyOptions.leverage

                    openPosition.size = asDecimal(Math.floor(usableUsdt.dividedBy(openPosition.entryPrice.times(strategyOptions.contractMultiplier)).times(leverage).toNumber()))
                    console.log("usable usdt: " + usableUsdt)
                    console.log("Order size:" + openPosition.size)
                    console.log("price on entry: " + entryPrice)
                    console.log("leverage: " + leverage)
                    console.log("contract multiplier: " + strategyOptions.contractMultiplier)

                }

                if (strategy.stopLoss) {
                    const initialStopDistance = strategy.stopLoss({
                        entryPrice: asDecimal(entryPrice),
                        position: openPosition,
                        bar: bar, 
                        lookback: new DataFrame<number, InputBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                    openPosition.initialStopPrice = openPosition.direction === TradeDirection.Long
                        ? asDecimal(entryPrice).minus(initialStopDistance)
                        : asDecimal(entryPrice).plus(initialStopDistance);
                    openPosition.curStopPrice = openPosition.initialStopPrice;
                }

                if (strategy.trailingStopLoss) {
                    const trailingStopDistance = strategy.trailingStopLoss({
                        entryPrice: asDecimal(entryPrice), 
                        position: openPosition,
                        bar: bar, 
                        lookback: new DataFrame<number, InputBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                    const trailingStopPrice = openPosition.direction === TradeDirection.Long
                        ? asDecimal(entryPrice).minus(trailingStopDistance)
                        : asDecimal(entryPrice).plus(trailingStopDistance)
                    if (openPosition.initialStopPrice === undefined) {
                        openPosition.initialStopPrice = trailingStopPrice;
                    }
                    else {
                        openPosition.initialStopPrice = openPosition.direction === TradeDirection.Long
                            ? Decimal.max(openPosition.initialStopPrice, trailingStopPrice)
                            : Decimal.min(openPosition.initialStopPrice, trailingStopPrice);
                    }

                    openPosition.curStopPrice = openPosition.initialStopPrice;

                    if (options.recordStopPrice) {
                        openPosition.stopPriceSeries = [
                            {
                                time: bar.time,
                                value: openPosition.curStopPrice
                            },
                        ];
                    }
                }

                if (openPosition.curStopPrice !== undefined) {
                    openPosition.initialUnitRisk = openPosition.direction === TradeDirection.Long
                        ? asDecimal(entryPrice).minus(openPosition.curStopPrice)
                        : openPosition.curStopPrice.minus(entryPrice)
                    openPosition.initialRiskPct = (openPosition.initialUnitRisk.div(entryPrice)).times(100)
                    openPosition.curRiskPct = openPosition.initialRiskPct;
                    openPosition.curRMultiple = asDecimal(0)

                    if (options.recordRisk) {
                        openPosition.riskSeries = [
                            {
                                time: bar.time,
                                value: openPosition.curRiskPct
                            },
                        ];
                    }
                }

                if (strategy.profitTarget) {
                    const profitDistance = strategy.profitTarget({
                        entryPrice: asDecimal(entryPrice), 
                        position: openPosition,
                        bar: bar, 
                        lookback: new DataFrame<number, InputBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                    openPosition.profitTarget = openPosition.direction === TradeDirection.Long
                        ? asDecimal(entryPrice).plus(profitDistance)
                        : asDecimal(entryPrice).minus(profitDistance)
                }

                positionStatus = PositionStatus.Position;
                break;

            case PositionStatus.Position:
                assert(openPosition !== null, "Expected open position to already be initialised!");

                if (openPosition!.curStopPrice !== undefined) {
                    if (openPosition!.direction === TradeDirection.Long) {
                        if (asDecimal(bar.low).lessThanOrEqualTo(openPosition!.curStopPrice!)) {
                            // Exit intrabar due to stop loss.
                            closePosition(bar, openPosition!.curStopPrice!, "stop-loss");
                            break;
                        }
                    }
                    else {
                        if (asDecimal(bar.high).greaterThanOrEqualTo(openPosition!.curStopPrice!)) {
                            // Exit intrabar due to stop loss.
                            closePosition(bar, openPosition!.curStopPrice!, "stop-loss");
                            break;
                        }
                    }
                }

                if (strategy.trailingStopLoss !== undefined) {
                    //
                    // Revaluate trailing stop loss.
                    //
                    const trailingStopDistance = strategy.trailingStopLoss({
                        entryPrice: openPosition!.entryPrice, 
                        position: openPosition!,
                        bar: bar, 
                        lookback: new DataFrame<number, InputBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                    
                    if (openPosition!.direction === TradeDirection.Long) {
                        const newTrailingStopPrice = asDecimal(bar.close).minus(trailingStopDistance)
                        if (newTrailingStopPrice.gt(openPosition!.curStopPrice!)) {
                            openPosition!.curStopPrice = newTrailingStopPrice;
                        }
                    }
                    else {
                        const newTrailingStopPrice = asDecimal(bar.close).plus(trailingStopDistance);
                        if (newTrailingStopPrice.lt(openPosition!.curStopPrice!)) {
                            openPosition!.curStopPrice = newTrailingStopPrice;
                        }
                    }

                    if (options.recordStopPrice) {
                        openPosition!.stopPriceSeries!.push({
                            time: bar.time,
                            value: openPosition!.curStopPrice!
                        });
                    }
                }

                if (openPosition!.profitTarget !== undefined) {
                    if (openPosition!.direction === TradeDirection.Long) {
                        if (asDecimal(bar.high).greaterThanOrEqualTo(openPosition!.profitTarget!)) {
                            // Exit intrabar due to profit target.
                            closePosition(bar, openPosition!.profitTarget!, "profit-target");
                            break;
                        }
                    }
                    else {
                        if (asDecimal(bar.low).lessThanOrEqualTo(openPosition!.profitTarget!)) {
                            // Exit intrabar due to profit target.
                            closePosition(bar, openPosition!.profitTarget!, "profit-target");
                            break;
                        }
                    }
                }
                
                updatePosition(openPosition!, bar);
                
                if (openPosition!.curRiskPct !== undefined && options.recordRisk) {
                    openPosition!.riskSeries!.push({
                        time: bar.time,
                        value: openPosition!.curRiskPct!
                    });
                }

                if (strategy.exitRule) {
                    strategy.exitRule(exitPosition, {
                        entryPrice: openPosition!.entryPrice,
                        position: openPosition!, 
                        bar: bar, 
                        lookback: new DataFrame<number, IndicatorBarT>(lookbackBuffer.data), 
                        parameters: strategyParameters
                    });
                }

                break;

            case PositionStatus.Exit:
                assert(openPosition !== null, "Expected open position to already be initialised!");

                closePosition(bar, asDecimal(bar.open), "exit-rule");
                break;
                
            default:
                throw new Error("Unexpected state!");
        }
    }

    if (openPosition) {
        // Finalize open position.
        const lastBar = indicatorsSeries.last();
        const lastTrade = finalizePosition(openPosition, lastBar.time, lastBar.close, "finalize", fees);
        completedTrades.push(lastTrade);
    }

    return completedTrades;
}

