var express = require('express');
var ProductsModel = require('../models/ProductsModel');
var CommentsModel= require("../models/CommentsModel");
//var loginRequired = require("../libs/loginRequired");
var adminRequired = require("../libs/adminRequired");
var CheckoutModel = require("../models/CheckoutModel");
var co = require('co');

var router = express.Router();

// csrf 셋팅
var csrf = require('csurf');
var csrfProtection = csrf({ cookie: true });

//이미지 저장되는 위치 설정
var path = require('path');
const uploadDir = path.join( __dirname , '../uploads' ); // root의 uploads위치에 저장한다.
var fs = require('fs');

//multer 셋팅
var multer  = require('multer');
var storage = multer.diskStorage({
    destination : function (req, file, callback) { //이미지가 저장되는 도착지 지정
        callback(null, uploadDir );
    },
    filename : function (req, file, callback) { // products-날짜.jpg(png) 저장 
        callback(null, 'products-' + Date.now() + '.'+ file.mimetype.split('/')[1] );
    }
});
var upload = multer({ storage: storage });

router.get('/', function(req, res){
    res.send('admin app');
});
/*
function testMiddleWare(req, res, next){
    console.log('test middleWare');
    next();
}
*/
router.get('/products', function(req, res){
    //res.send('admin products');
    //res.render('admin/products', {message : "hello"});
    //res.render('admin/products', {data : "my data"});
    ProductsModel.find(function(err, products){
        res.render('admin/products', {products : products}); // DB에서 받은 products를 products 변수명으로 내보냄
    });
});

router.get('/products/write', adminRequired, csrfProtection, function(req, res){
    //res.render('admin/form', {product : ""}); // 수정 후 작성하기 누르면 변수값을 찾지 못하여 에러가 나서 product값""을 전달하게 함    
     res.render( 'admin/form' , { product : "", csrfToken : req.csrfToken() }); //edit에서도 같은 form을 사용하므로 빈 변수( product )를 넣어서 에러를 피해준다
});

router.post('/products/write', adminRequired, upload.single('thumbnail'), csrfProtection, function(req, res){
    //console.log(req.file);
    var product = new ProductsModel({
        name : req.body.name,
        //thumbnail : (req.file) ? req.file.filename : product.thumbnail,
        thumbnail : (req.file) ? req.file.filename : "",
        price : req.body.price,
        description : req.body.description,
        username : req.user.username
    });

    var validationError = product.validateSync();
    if(validationError){
        res.send(validationError);
    }else{
        product.save(function(err){
            res.redirect('/admin/products');
        });
    }
/*
    product.save(function(err){
        res.redirect('/admin/products');
    });
*/
});

router.get('/products/detail/:id' ,adminRequired, function(req, res){
    //url 에서 변수 값을 받아올땐 req.params.id 로 받아온다
    //하단 주석부분 방식에서 이걸로 방식변경 (ES6 Generator 방식 - 콜백헬 개선)
    var getData = co(function* (){
        return {
            product : yield ProductsModel.findOne( { 'id' :  req.params.id }).exec(),
            comments : yield CommentsModel.find( { 'product_id' :  req.params.id }).exec()
        };
    });
    getData.then( function(result){
       //res.send(result);
       res.render('admin/productsDetail', { product: result.product , comments : result.comments });
    });
 
    /*
    //url 에서 변수 값을 받아올땐 req.params.id 로 받아온다
    ProductsModel.findOne( { 'id' : req.params.id } , function(err ,product){
        //제품정보를 받고 그안에서 댓글을 받아온다.
        CommentsModel.find({ product_id : req.params.id } , function(err, comments){
            res.render('admin/productsDetail', { product: product , comments : comments });
        });
        //res.render('admin/productsDetail', { product: product }); 
    });
    */

});

router.get('/products/edit/:id', adminRequired, csrfProtection, function(req, res){
    //기존에 폼에 value안에 값을 셋팅하기 위해 만든다.
    ProductsModel.findOne({ id : req.params.id } , function(err, product){
        res.render('admin/form', { product : product, csrfToken : req.csrfToken() });
    });
});

router.post('/products/edit/:id', adminRequired, upload.single('thumbnail'), csrfProtection, function(req, res){
    ProductsModel.findOne( {id : req.params.id} , function(err, product){

        if(product.thumbnail && req.file){  //요청중에 파일이 존재 할 시 이전 이미지 지운다.
            fs.unlinkSync( uploadDir + '/' + product.thumbnail );
        }

        //넣을 변수 값을 셋팅한다
        var query = {
            name : req.body.name,
            thumbnail : (req.file) ? req.file.filename : product.thumbnail,
            price : req.body.price,
            description : req.body.description,
        };

        //update의 첫번째 인자는 조건, 두번째 인자는 바뀔 값들
        ProductsModel.update({ id : req.params.id }, { $set : query }, function(err){
            res.redirect('/admin/products/detail/' + req.params.id ); //수정 후 본래보던 상세페이지로 이동
        });
    });
});

router.get('/products/delete/:id', function(req, res){
    ProductsModel.remove({ id : req.params.id }, function(err){
        res.redirect('/admin/products');
    });
});

router.post('/products/ajax_comment/insert', function(req, res){
    var comment = new CommentsModel({
        content : req.body.content,
        product_id : parseInt(req.body.product_id)
    });
    comment.save(function(err, comment){
        res.json({
            id : comment.id,
            content : comment.content,
            message : "success"
        });
    });
});

router.post('/products/ajax_comment/delete', function(req, res){
    CommentsModel.remove({ id : req.body.comment_id } , function(err){
        res.json({ message : "success" });
    });
});

router.post('/products/ajax_summernote', adminRequired, upload.single('thumbnail'), function(req, res){
    res.send( '/uploads/' + req.file.filename);
});


router.get('/order', function(req,res){
    CheckoutModel.find( function(err, orderList){ //첫번째 인자는 err, 두번째는 받을 변수명
        res.render( 'admin/orderList' , 
            { orderList : orderList }
        );
    });
});

router.get('/order/edit/:id', function(req,res){
    CheckoutModel.findOne( { id : req.params.id } , function(err, order){
        res.render( 'admin/orderForm' , 
            { order : order }
        );
    });
});

router.post('/order/edit/:id', adminRequired, function(req,res){
    var query = {
        status : req.body.status,
        song_jang : req.body.song_jang
    };

    CheckoutModel.update({ id : req.params.id }, { $set : query }, function(err){
        res.redirect('/admin/order');
    });
});

/*
router.get('/statistics', adminRequired, function(req,res){
    res.render('admin/statistics');
});
*/
router.get('/statistics', adminRequired, function(req,res){
    CheckoutModel.find( function(err, orderList){ 

        var barData = [];   // 넘겨줄 막대그래프 데이터 초기값 선언
        var pieData = [];   // 원차트에 넣어줄 데이터 삽입
        orderList.forEach(function(order){
            // 08-10 형식으로 날짜를 받아온다
            var date = new Date(order.created_at);
            var monthDay = (date.getMonth()+1) + '-' + date.getDate();
            
            // 날짜에 해당하는 키값으로 조회
            if(monthDay in barData){
                barData[monthDay]++; //있으면 더한다
            }else{
                barData[monthDay] = 1; //없으면 초기값 1넣어준다.
            }

            // 결재 상태를 검색해서 조회
            if(order.status in pieData){
                pieData[order.status]++; //있으면 더한다
            }else{
                pieData[order.status] = 1; //없으면 결재상태+1
            }

        });

        res.render('admin/statistics' , { barData : barData , pieData:pieData });
    });
});

module.exports = router;
