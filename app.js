require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("./models/index.js");
const app = express();
const { Users, Product } = db
app.use(express.json()); // body를 json형태로 불러온다. 썬더에서 body값을 불러오기 위해서 써야한다.node 

// 회원가입
app.post("/users", async (req, res) => {
    const { email, name, password, confirmPassword } = req.body;
    // 패스워드와 패스워드 확인란 비교
    if (password !== confirmPassword) {
        res.status(400).send({
            errormessage: "비밀번호와 비밀번호 확인이 다릅니다."
        });
        return;
    }

    // 이메일 유효성 검사
    const validEmailCheck = (email) => {
        const pattern = /^[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/i;
        return pattern.test(email)
    }

    if (validEmailCheck(email) == false) {
        res.status(400).send({
            errormessage: "올바른 이메일 주소를 입력해주세요."
        });
        return;
    }

    // 비밀번호 유효성 검사
    if (password.length < 6) {
        res.status(400).send({
            errormessage: "비밀번호 6글자 이상을 사용해주세요."
        })
        return;
    }




    // 회원 정보에서 email or name 동일한게 있는지 확인
    const existUser = await Users.findOne({
        where: { email }
    });
    console.log({ existUser });
    if (existUser) {
        res.status(400).send({
            errormessage: "email이 이미 사용중입니다."
        });
        return;
    }

    // 없으면 회원정보 추가
    const user = await Users.create({ email, name, password });

    // 회원가입 후 password를 제외한 정보를 보여준다.
    const userWithoutPassword = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        updatedAt: user.updatedAt,
        createdAt: user.createdAt
    };

    res.status(201).json({ user: userWithoutPassword });
    return;
});

// 로그인

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
console.log("email => ", email)
    // 이메일 같은게 있는지 확인
    const user = await Users.findOne({
        where: { email : email }
    });
console.log("user => ", user)
    // 이메일, 패스워드 일치하는지 확인
    if (!user || password !== user.password) {
        res.status(400).send({
            errormessage: "사용자가 존재하지 않거나, 사용자의 password와 입력받은 password가 일치하지 않습니다."
        });
        return;
    }

    const token = jwt.sign({ userId: user.id }, "jwt-secret-key", { expiresIn: "12h" }); // jwt.sign은 암호화 하기 위해 사용
    console.log(typeof token);
    res.status(200).send({
        message: "로그인 성공",
        "token": token
    });
    return;
})
// 유저정보 확인
const signIncheck = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;
        const [authType, authToken] = (authorization || "").split(" ");
        if (!authToken || authType !== "Bearer") {
            res.status(401).send({ errorMessage: "로그인 후 이용 가능한 기능입니다.", });
            return;
        }
        const userInfo = jwt.verify(authToken, "jwt-secret-key");
        console.log("userInfo",userInfo)
        const user = await Users.findOne({ where: { id: userInfo.userId } })
        console.log("user",user)
        res.locals.user = user

        // JWT 유효기간 지난경우
    } catch (err) {
        if (err.message === "jwt expired") {
            return res.status(401).send({
                ok: false,
                message: "토큰이 만료되었습니다."
            });
        }

        return res.status(401).send({
            ok: false,
            message: "토큰이 손상되었습니다."
        });
    }
    next();
}

// 상품 생성
app.post("/products", signIncheck, async (req, res) => {
    const { title, content } = req.body
    const userId = res.locals.user.id
    try {
        await Product.create({ title, content, status: "FOR_SALE", userId });
        res.json({ message: "판매 상품을 등록하였습니다." });
    } catch (error) {
        console.log(error)
        res.status(400).json({ errormessage: "데이터 형식이 올바르지 않습니다." });
    }
})

// 상품 수정
app.put("/products/:productId", signIncheck, async (req, res) => {
    const { productId } = req.params;
    const { title, content, status } = req.body 
    const userId = res.locals.user.id // 인증에 성공한 userId
    // product의 userId
    const productuserid = await Product.findOne({where : {id: productId}}) // product의 userId값
    
    // 상품이 존재하지 않는다면
    if (!productuserid) {
        res.status(400).send({
            errormessage: "상품 조회에 실패하였습니다."
        })
        return;
    }
    
    // 인증성공 userID와 상품등록 사용자의 userID가 다르면
    if (userId !== productuserid.userId) {
        res.status(400).send({
            errormessage : "사용자와 상품등록 사용자가 일치하지 않습니다."
        })
        return;
    }
    

    await productuserid.update({title, content})

    res.status(200).send({
        message : "상품 수정이 완료되었습니다."
    })

})

// 상품 삭제
// 미들웨어 사용 x
// 사용자 userid, 상품등록 userid 일치할때 삭제 
// 존재하지 않을경우 "상품 조회에 실패하였습니다."
app.delete("/products/:productId",signIncheck, async(req,res) => {
    const {productId} = req.params;

    // 인증에 성공한 userId
    const userId = res.locals.user.id;

    // product의 userId값
    const productuserid = await Product.findOne({where : {id: productId}});
    
    

    // 상품이 존재하지 않는다면
    if (!productuserid) {
        res.status(400).send({
            errormessage: "상품 조회에 실패하였습니다."
        })
        return;
    }

    // 인증성공 userID와 상품등록 사용자의 userID가 다르면
    if (userId !== productuserid.userId) {
        res.status(400).send({
            errormessage : "사용자와 상품등록 사용자가 일치하지 않습니다."
        })
        return;
    }
    
    await productuserid.destroy({});

    res.status(200).send({
        message : "상품을 삭제하였습니다."
    })
    
  });

// 상품 목록 조회
app.get("/products", async (req, res) => {
    const product = await Product.findAll({
        include: [
            { model: Users, as: "user", attributes: ["name"] }
        ],
        order: [["createdAt", "DESC"]]
    });
    res.status(200).json({ data: product });
});

// 상품 상세 조회
app.get("/products/:productId", async (req, res) => {
    const {productId} = req.params;
    const products = await Product.findOne({
        include: [
            { model: Users, as: "user", attributes: ["name"] }
        ],
        where: { id : productId },
        order: [["createdAt", "DESC"]]
    });
    res.status(200).json({ data: products });
});


app.listen(3000, () => {
    console.log("서버가 열렸다.")
});