import Decimal from "decimal.js";
import { asDecimal } from "../lib/backtest";
import { ITrade } from "../lib/trade";

export interface SharpeOptions {
  riskFreeRate: Decimal.Value;
  coefficient: Decimal.Value;
}

// np prefixed functions try to mimic corresponding numpy functions (basic)

// Function that calculates the difference between consecutive elements of an array
export function npDiff(arr: Decimal.Value[]) {
    // Create a new array that contains the difference between each element and the preceding element
    const result = arr
      .slice(1) // Remove the first element of the array
      .map((v, i) => new Decimal(v).minus(arr[i]).toNumber()); // Compute the difference between each element and its predecessor
  
    return result; 
  }
  

// Calculate mean for array
export function npMean(arr: number[]){
    // Creating the mean with Array.reduce
    return new Decimal(arr.reduce((acc: number, curr: number)=>{
      return new Decimal(acc).plus(curr).toNumber()
    }, 0)).div(arr.length).toNumber()
  }

// Calculate the standard deviation of an array
export function npStd(arr: number[]){

    let mean = npMean(arr)
        
    // Assigning (value - mean) ^ 2 to every array item
    arr = arr.map((k)=>{
        return (new Decimal(k).minus(mean)).pow(2).toNumber()
    })
        
    // Calculating the sum of updated array
    let sum = arr.reduce((acc, curr) => new Decimal(acc).plus(curr).toNumber(), 0);

    // Calculating the variance
    let variance = new Decimal(sum).div(arr.length).toNumber()

    // Returning the standard deviation
    return Decimal.sqrt(new Decimal(sum).div(arr.length)).toNumber()
}

export function sharpe(accountValues: Decimal.Value[], riskFreeRate: Decimal.Value, annualizeCoefficient: Decimal.Value) {
    const accountValuesWithoutFirst = accountValues.slice(1);

    const diff = npDiff(accountValues).map((d, i) => {
        return new Decimal(d).dividedBy(accountValuesWithoutFirst[i]).toNumber();
    });

    const annualizedStd = new Decimal(npStd(diff)).times(Decimal.sqrt(annualizeCoefficient))
    const result = new Decimal(npMean(diff))
    .times(annualizeCoefficient)
    .minus(riskFreeRate)
    .dividedBy(annualizedStd)
    .toNearest(0.0000000000000002, Decimal.ROUND_DOWN)
    .toNumber()

    return result
}

export function calculateAverageDailyReturn(trades: ITrade[]): number {
  let totalReturn = asDecimal(0)
  let totalDays = 0;

  for (const trade of trades) {
    const entryTime = trade.entryTime.getTime();
    const exitTime = trade.exitTime.getTime();
    const holdingPeriod = (exitTime - entryTime) / (1000 * 60 * 60 * 24); // Convert milliseconds to days
    const returnOnTrade = trade.profitPct

    totalReturn = totalReturn.plus(returnOnTrade)
    totalDays += holdingPeriod;
  }

  const averageDailyReturn = totalReturn.div(totalDays);

  return averageDailyReturn.toNumber()
}

/** Calculate calmar ratio
 * Calmar = AAR / MDD
 */

export function calmar(adr: number, mdd: number): number {
  const annualizedReturn = Decimal.pow(asDecimal(1).plus(adr), 365).minus(1)
  const calmarRatio = annualizedReturn.div(Decimal.abs(mdd))
  return calmarRatio.toNumber()
}