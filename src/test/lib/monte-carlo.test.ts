import { assert, expect } from 'chai';
import { monteCarlo } from '../../lib/monte-carlo';
import { ITrade, backtest } from '../..';
import Decimal from 'decimal.js'
import { asDecimal } from '../../lib/backtest';

describe("monte-carlo", () => {

    it("zero trades produces zero samples", () => {
        const trades: ITrade[] = [];
        const samples = monteCarlo(trades, 2, 2);
        expect(samples.length).to.eql(0);
    });

    it("can produce sequence of samples from population of one", () => {
        const trades: ITrade[] = [
            {
                entryPrice: asDecimal(5)
            } as ITrade,
        ];
        const samples = monteCarlo(trades, 3, 2);
        expect(samples.length).to.eql(3);
        
        const first = samples[0];
        expect(first.length).to.eql(2);
        expect(first[0].entryPrice).to.eql(asDecimal(5));
        expect(first[1].entryPrice).to.eql(asDecimal(5));

        const second = samples[1];
        expect(second.length).to.eql(2);
        expect(second[0].entryPrice).to.eql(asDecimal(5));
        expect(second[1].entryPrice).to.eql(asDecimal(5));
        
        const third = samples[2];
        expect(third.length).to.eql(2);
        expect(third[0].entryPrice).to.eql(asDecimal(5));
        expect(third[1].entryPrice).to.eql(asDecimal(5));
    });

    it("can produce sequence of samples from population", () => {
        const trades: ITrade[] = [
            {
                entryPrice: asDecimal(1)
            } as ITrade,
            {
                entryPrice: asDecimal(2)
            } as ITrade,
            {
                entryPrice: asDecimal(3)
            } as ITrade,
            {
                entryPrice: asDecimal(4)
            } as ITrade,
        ];
        const samples = monteCarlo(trades, 4, 3);
 
        expect(samples.length).to.eql(4);

        // Cannot use to.eql here since we deal with Decimal objects that are nested in arrays.
        // https://medium.com/building-ibotta/testing-arrays-and-objects-with-chai-js-4b372310fe6d

        expect(samples).to.include.deep.members(
            [                            
                [                        
                    {                    
                        "entryPrice": asDecimal(3)  
                    },                   
                    {                    
                        "entryPrice": asDecimal(3)  
                    },                   
                    {                    
                        "entryPrice": asDecimal(3)  
                    }                    
                ],                       
                [                        
                    {                    
                        "entryPrice": asDecimal(4)  
                    },                   
                    {                    
                        "entryPrice": asDecimal(3)  
                    },                   
                    {                    
                        "entryPrice": asDecimal(4)  
                    }                    
                ],                       
                [                        
                    {                    
                        "entryPrice": asDecimal(3)  
                    },                   
                    {                    
                        "entryPrice": asDecimal(4)  
                    },                   
                    {                    
                        "entryPrice": asDecimal(2)  
                    }                    
                ],                       
                [                        
                    {                    
                        "entryPrice": asDecimal(3)  
                    },                   
                    {                    
                        "entryPrice": asDecimal(3)  
                    },                   
                    {                    
                        "entryPrice": asDecimal(2)  
                    }                    
                ]                        
            ]                            
        );
    });
});
