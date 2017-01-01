/**
 * Created by wwymak on 26/09/15.
 */

var dataParse = {},
    heatmapChart = {};

(function($){

    Number.prototype.roundToHigherPrecision = function(){
        var newNumber = this.toPrecision(1);
        if (+newNumber < this){
            var exponent = newNumber.split("+")[1];
            return +newNumber + Math.pow(10, exponent);
        }else{
            return newNumber;
        }
    }

    dataParse.getTweetData = function(){
        //var dataXHR = $.ajax("http://localhost:8080/api/tweets_all_sorted_by_date");
        var dataXHR = $.ajax("/api/tweets_all_example");
        return dataXHR.then(dataParse.getXY);
    };

    dataParse.getNewTweetData = function(screenName){
        var dataXHR = $.ajax({
            type: "POST",
            url: "/api/get_new_tweets",
            data: {"screenName": $("#newScreenName").val() }
        });
        return dataXHR.then(dataParse.getXY);
    }

    dataParse.getXY = function(tweetDataArr){
        for (var i = 1; i< tweetDataArr.length-1; i++){
            var currDateObj = new Date(tweetDataArr[i].created_at);
            tweetDataArr[i].xVal
                = (currDateObj - new Date(tweetDataArr[i+1].created_at))/1000; //time before event
            tweetDataArr[i].yVal
                = (new Date(tweetDataArr[i-1].created_at) - currDateObj)/1000; //time before event
            tweetDataArr[i].timeOfDay = currDateObj.getHours();
        }
        heatmapChart.dataArr = tweetDataArr.slice(1, tweetDataArr.length-1)
    };

    heatmapChart.init = function(opts){
        heatmapChart.colorScale = d3.scale.linear().domain([0,12,24]).range(['red', 'green', 'purple']);

        heatmapChart.width = opts.width|| 600;
        heatmapChart.height = opts.height || 600;
        heatmapChart.margins = opts.margins || {top: 20, bottom: 20, right: 20, left: 50};
        heatmapChart.parentID = opts.parentID || 'body';

        heatmapChart.svg = d3.select(heatmapChart.parentID).append("svg")
            .attr("width", heatmapChart.width + heatmapChart.margins.left + heatmapChart.margins.right)
            .attr("height", heatmapChart.height + heatmapChart.margins.top + heatmapChart.margins.bottom);

        heatmapChart.svgG = heatmapChart.svg.append("g");

        heatmapChart.xScale = d3.scale.log()
            .range([heatmapChart.margins.left, heatmapChart.width + heatmapChart.margins.left]);
        heatmapChart.yScale = d3.scale.log()
            .range([heatmapChart.height + heatmapChart.margins.top, heatmapChart.margins.top]);

        heatmapChart.xAxisG = heatmapChart.svg.append("g")
            .attr("transform", "translate(0," + (heatmapChart.height + heatmapChart.margins.top) + ")")
            .attr("class","x axis")

        heatmapChart.yAxisG = heatmapChart.svg.append("g")
            .attr("transform", "translate(" + heatmapChart.margins.left + ",0)")
            .attr("class","y axis")

        heatmapChart.svg.append("g").append("text")
            .attr("class", "x label")
            .attr("text-anchor", "middle")
            .attr("transform", "translate(" + 0.5 * heatmapChart.width + "," + (heatmapChart.height + heatmapChart.margins.bottom) + ")")
            .text("time before tweet");


    };

    heatmapChart.setTickFormat = function(val, index){
        if(index % 5 != 0){
            return ""
        }else{
            var outputText = ""
            switch (true){

                case (val <60):
                    outputText =  Math.round(val) + " s";
                    break;
                case (val <3600):
                    outputText =  Math.round(val/60) + " min";
                    break;
                case (val < 3600 * 24):
                    outputText =  Math.round(val/3600) + " hours";
                    break;
                default:
                    outputText = Math.round(val/(3600 * 24)) + " day";
            }

            return outputText;
        }
    }

    heatmapChart.setScaleRanges =function(dataArr){
        var xMax = d3.max(dataArr, function(d){
            return d.xVal;
        }),
            yMax = d3.max(dataArr, function(d){
                return d.yVal;
            });
        heatmapChart.xScale.domain([1, xMax.roundToHigherPrecision()]);
        heatmapChart.yScale.domain([1, yMax.roundToHigherPrecision()]);

        heatmapChart.xAxis = d3.svg.axis().scale(heatmapChart.xScale).tickFormat(heatmapChart.setTickFormat)
        heatmapChart.yAxis = d3.svg.axis().scale(heatmapChart.yScale)
            .tickFormat(heatmapChart.setTickFormat).orient("left");

        heatmapChart.svg.append("g").append("text")
            .attr("class", "y label")
            .attr("text-anchor", "middle")
            .attr("transform", "translate(" + 0.25 * heatmapChart.margins.left +  ","
            + (0.5 * heatmapChart.height + heatmapChart.margins.top) + ")rotate(-90)")
            .text("time after tweet");



    };

    heatmapChart.setHistogramBins = function(nSide){ //nSide = no. of bins along each x and y
        var arr = d3.range(nSide + 1)// [0,1, ... nSide]
        var xMax = heatmapChart.xScale.domain()[1],
            yMax = heatmapChart.yScale.domain()[1],
            xLogStep = Math.log10(xMax)/nSide, //**part of ECMA6 should work in chrome
            yLogStep = Math.log10(yMax)/nSide;

        var xBinThresholdsLogged = (arr.map(function(d){return d *xLogStep})).slice(1),
            yBinThresholdsLogged = (arr.map(function(d){return d *yLogStep})).slice(1);

        var xBinThresholds = xBinThresholdsLogged.map(function(i){return Math.pow(10, i)}),
            yBinThresholds = yBinThresholdsLogged.map(function(i){return Math.pow(10, i)});

        heatmapChart.histX = d3.layout.histogram()
            .bins(xBinThresholds).value(function(d){return d.xVal});
        heatmapChart.histY = d3.layout.histogram()
            .bins(yBinThresholds).value(function(d){return d.yVal});
    };

    heatmapChart.getBinnedData = function(){
        var maxBinVal = 0;// highest frequency
        var xBinned = heatmapChart.histX(heatmapChart.dataArr);

        xBinned.forEach(function(d){
            d.yBinned = heatmapChart.histY(d);
            var tempMax = d3.max(d.yBinned, function(d){return d.y});
            if(tempMax > maxBinVal){maxBinVal = tempMax}
        });

        heatmapChart.xBinned = xBinned;
        heatmapChart.maxBinVal = maxBinVal;
    };

    //so convert the arrays pf arrays of xBinned to a single array of objects with x, y dx and dy vals for plotting
    heatmapChart.convertBinsToXY = function(){
        var outputArr = [];
        for(var i = 0; i< heatmapChart.xBinned.length; i++){
            var yArr = heatmapChart.xBinned[i].yBinned;
            var tempX = heatmapChart.xBinned[i].x,
                temp_dx = heatmapChart.xBinned[i].dx;

            for(var j = 0; j< yArr.length; j++){
                var tempObj = {};
                tempObj.x = tempX;
                tempObj.dx = temp_dx;
                tempObj.y = yArr[j].x;
                tempObj.dy = yArr[j].dx;
                tempObj.val = yArr[j].y;
                outputArr.push(tempObj);
            }
        }
        return outputArr;
    };

    //convert the number of points in each bin into a color val (hsl) based on the max number
    heatmapChart.calcHSL = function(val, maxVal){
        //var h = (1 - val/maxVal) * 360,
        //    s = 100,
        //    l = 1- val/maxVal

        var h = (1.0 - val/maxVal) * 240
        var color =  "hsl(" + h + ", 100%, 50%)";

        return d3.hsl(color);
    };

    heatmapChart.drawMap = function(){
        var data = heatmapChart.convertBinsToXY();
        var maxVal = d3.max(data, function(d){
            return d.val
        });
        var heatmap = heatmapChart.svgG.selectAll(".bins")
            .data(data);

        heatmap.enter().append("rect")
            .attr("x", function(d){return heatmapChart.xScale(d.x) })
            .attr("y", function(d){return heatmapChart.yScale(d.y) })
            .attr("width", function(d){return heatmapChart.xScale(d.x + d.dx) - heatmapChart.xScale(d.x)})
            .attr("height", function(d){return Math.abs(heatmapChart.yScale(d.y + d.dy) - heatmapChart.yScale(d.y) )})
            .attr("fill", function(d){return heatmapChart.calcHSL(d.val, maxVal)})
            .attr("stroke", function(d){return heatmapChart.calcHSL(d.val, maxVal)});

        heatmap.attr("x", function(d){return heatmapChart.xScale(d.x) })
            .attr("y", function(d){return heatmapChart.yScale(d.y) })
            .attr("width", function(d){return heatmapChart.xScale(d.x + d.dx) - heatmapChart.xScale(d.x)})
            .attr("height", function(d){return Math.abs(heatmapChart.yScale(d.y + d.dy) - heatmapChart.yScale(d.y) )})
            .attr("fill", function(d){return heatmapChart.calcHSL(d.val, maxVal)})
            .attr("stroke", function(d){return heatmapChart.calcHSL(d.val, maxVal)});

        heatmap.exit().remove();

        heatmapChart.xAxisG.call(heatmapChart.xAxis);
        heatmapChart.yAxisG.call(heatmapChart.yAxis);

        d3.selectAll(".axis").selectAll(".tick").select("line")
            .attr("opacity", function(d, i){
                if(i%5 != 0){
                    return  0
                }else{
                    return 1
                }}
        )


    }

    $(document).ready(function(){
        var parent = $("#heatmap");
        heatmapChart.init({
            width: 0.8 * parent.width(),
            height:  0.8 * parent.width(),
            parentID : "#heatmap",
            margins: {top: 20, bottom: 80, right: 20, left: 80}
        });

        var dataGetPromise = dataParse.getTweetData();
        dataGetPromise.then(function(){heatmapChart.setScaleRanges(heatmapChart.dataArr)})
            .then(function(){heatmapChart.setHistogramBins(80)}).then(heatmapChart.getBinnedData)
            .then(heatmapChart.drawMap);

        $("#getDataBtn").on("click", function(e){
            e.preventDefault();
            $(".loader-container").toggleClass('custom-hidden');
            $("#newNameInput").toggleClass('custom-hidden');

            var screenName = $("#newScreenName").val();
            var newDataPromise = dataParse.getNewTweetData(screenName)
            newDataPromise.then(function(){heatmapChart.setScaleRanges(heatmapChart.dataArr)})
                .then(function(){heatmapChart.setHistogramBins(80)}).then(heatmapChart.getBinnedData)
                .then(heatmapChart.drawMap).then(function(){
                    $("#twitterHandle").text("@" + screenName)
                    $("#newScreenName").val("");
                    $(".loader-container").toggleClass('custom-hidden');
                    $("#newNameInput").toggleClass('custom-hidden');

                });

        })

        $("#newScreenName").on('keyup', function(e){
            if (e.keyCode == '13') {
                $("#getDataBtn").trigger('click')
            }
        })


    })

})(jQuery);